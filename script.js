// ============================================================================
// CONSTANTS
// ============================================================================
const ALL_MAPS = [
    "Corrode", "Haven", "Icebox", "Split", "Pearl", "Bind", 
    "Fracture", "Breeze", "Abyss", "Sunset", "Lotus", "Ascent"
];

const AGENT_POOL = [
    // Duelist
    { name: "Jett", role: "Duelist" }, { name: "Raze", role: "Duelist" }, { name: "Reyna", role: "Duelist" },
    { name: "Phoenix", role: "Duelist" }, { name: "Yoru", role: "Duelist" }, { name: "Neon", role: "Duelist" },
    { name: "Iso", role: "Duelist" }, { name: "Waylay", role: "Duelist" },
    // Initiator
    { name: "Sova", role: "Initiator" }, { name: "Fade", role: "Initiator" }, { name: "Skye", role: "Initiator" },
    { name: "Gekko", role: "Initiator" }, { name: "Breach", role: "Initiator" }, { name: "KAY/O", role: "Initiator" },
    { name: "Tejo", role: "Initiator" },
    // Controller
    { name: "Astra", role: "Controller" }, { name: "Brimstone", role: "Controller" }, { name: "Clove", role: "Controller" },
    { name: "Harbor", role: "Controller" }, { name: "Miks", role: "Controller" }, { name: "Omen", role: "Controller" },
    { name: "Viper", role: "Controller" },
    // Sentinel
    { name: "Chamber", role: "Sentinel" }, { name: "Cypher", role: "Sentinel" }, { name: "Deadlock", role: "Sentinel" },
    { name: "Killjoy", role: "Sentinel" }, { name: "Sage", role: "Sentinel" }, { name: "Veto", role: "Sentinel" },
    { name: "Vyse", role: "Sentinel" }
];

const NORMAL_TURN_SEQUENCE = [
    { phase: "Ban Phase 1", type: "ban", team: 1 }, { phase: "Ban Phase 1", type: "ban", team: 2 },
    { phase: "Ban Phase 1", type: "ban", team: 1 }, { phase: "Ban Phase 1", type: "ban", team: 2 },
    { phase: "Pick Phase 1", type: "pick", team: 1 }, { phase: "Pick Phase 1", type: "pick", team: 2 },
    { phase: "Pick Phase 1", type: "pick", team: 2 }, { phase: "Pick Phase 1", type: "pick", team: 1 },
    { phase: "Pick Phase 1", type: "pick", team: 1 }, { phase: "Pick Phase 1", type: "pick", team: 2 },
    { phase: "Ban Phase 2", type: "ban", team: 2 }, { phase: "Ban Phase 2", type: "ban", team: 1 },
    { phase: "Pick Phase 2", type: "pick", team: 2 }, { phase: "Pick Phase 2", type: "pick", team: 1 },
    { phase: "Pick Phase 2", type: "pick", team: 1 }, { phase: "Pick Phase 2", type: "pick", team: 2 }
];

// Map draft rules for Pro Mode. "W" = Coin toss winner (Team 1), "L" = Loser (Team 2)
const PRO_MAP_SEQUENCES = {
    'BO1': [
        { action: 'ban', team: 1 }, { action: 'ban', team: 2 }, { action: 'ban', team: 1 },
        { action: 'ban', team: 2 }, { action: 'ban', team: 1 }, { action: 'ban', team: 2 },
        { action: 'decider', team: 'auto' }
    ],
    'BO3': [
        { action: 'ban', team: 1 }, { action: 'ban', team: 2 },
        { action: 'pick', team: 1 }, { action: 'side', team: 2 },
        { action: 'pick', team: 2 }, { action: 'side', team: 1 },
        { action: 'ban', team: 1 }, { action: 'ban', team: 2 },
        { action: 'decider', team: 'auto' }, { action: 'side', team: 1 }
    ],
    'BO5': [
        { action: 'ban', team: 1 }, { action: 'ban', team: 2 },
        { action: 'pick', team: 1 }, { action: 'side', team: 2 },
        { action: 'pick', team: 2 }, { action: 'side', team: 1 },
        { action: 'pick', team: 1 }, { action: 'side', team: 2 },
        { action: 'pick', team: 2 }, { action: 'side', team: 1 },
        { action: 'decider', team: 'auto' }, { action: 'side', team: 'random' }
    ]
};

// ============================================================================
// APP STATE
// ============================================================================
let appState = getInitialState();
let timerInterval = null;

function getInitialState() {
    return {
        mode: 'home', // home, start, random, pro
        timer: 50,
        normal: {
            team1Name: "Team 1", team2Name: "Team 2",
            roster1: [], roster2: [],
            map: "",
            turnIndex: 0,
            bans: [], picks: [],
            selectedRole: "Any"
        },
        pro: {
            team1Name: "", team2Name: "",
            format: "BO1",
            pool: [], // 7 selected maps
            coinWinner: 1,
            mapDraftStep: 0,
            mapDraftLog: [], // track bans/picks
            finalMaps: [], // { name, atkTeam, defTeam, bans: [], picks: [], turnIndex: 0 }
            activeMapIndex: 0,
            searchQuery: "", roleFilter: "All"
        },
        proUndoStack: []
    };
}

// ============================================================================
// NAVIGATION & RESET
// ============================================================================
function resetApp() {
    stopTimer();
    appState = getInitialState();
    switchView('home');
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    document.getElementById('app-main').className = ''; // remove active team styles
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================================================
// MODE SETUP
// ============================================================================
function startSetup(mode) {
    appState.mode = mode;
    if (mode === 'start') {
        doMapRollAnimation();
    } else if (mode === 'random') {
        renderRandomSetup();
        switchView('random-setup');
    } else if (mode === 'pro') {
        renderProSetup();
        switchView('pro-setup');
    }
}

// ============================================================================
// NORMAL & RANDOM DRAFT ENGINE
// ============================================================================
function renderRandomSetup() {
    const container = document.getElementById('player-inputs-container');
    container.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
        container.innerHTML += `<input type="text" id="p${i}" placeholder="Player ${i}">`;
    }
}

function shuffleRandomTeams() {
    let players = [];
    for (let i = 1; i <= 10; i++) {
        let val = document.getElementById(`p${i}`).value.trim();
        players.push(val || `Player ${i}`);
    }
    // Shuffle array
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }
    appState.normal.roster1 = players.slice(0, 5);
    appState.normal.roster2 = players.slice(5, 10);
    doMapRollAnimation();
}

function doMapRollAnimation() {
    switchView('animation');
    const display = document.getElementById('anim-display');
    document.getElementById('anim-title').innerText = "ROLLING MAP...";
    
    let rollCount = 0;
    let intervalTime = 100;
    
    const roll = () => {
        display.innerText = ALL_MAPS[Math.floor(Math.random() * ALL_MAPS.length)];
        rollCount++;
        
        if (rollCount < 20) {
            setTimeout(roll, intervalTime);
        } else if (rollCount < 30) {
            intervalTime += 30;
            setTimeout(roll, intervalTime);
        } else {
            // Final Map
            const finalMap = ALL_MAPS[Math.floor(Math.random() * ALL_MAPS.length)];
            display.innerText = finalMap;
            display.classList.add('anim-pulse');
            appState.normal.map = finalMap;
            
            setTimeout(() => {
                display.classList.remove('anim-pulse');
                startNormalDraft();
            }, 2000);
        }
    };
    roll();
}

function startNormalDraft() {
    appState.normal.turnIndex = 0;
    appState.normal.bans = [];
    appState.normal.picks = [];
    switchView('draft');
    updateNormalDraftUI();
}

function updateNormalDraftUI() {
    const state = appState.normal;
    const isFinished = state.turnIndex >= NORMAL_TURN_SEQUENCE.length;
    
    // Set Header/Rosters
    document.getElementById('name-t1').innerText = state.team1Name;
    document.getElementById('name-t2').innerText = state.team2Name;
    document.getElementById('draft-map-name').innerText = state.map;
    document.getElementById('roster-t1').innerHTML = state.roster1.join('<br>');
    document.getElementById('roster-t2').innerHTML = state.roster2.join('<br>');

    const mainApp = document.getElementById('app-main');
    document.getElementById('role-selector').classList.add('hidden');
    document.getElementById('agent-search-bar').classList.add('hidden');
    document.getElementById('final-actions').classList.add('hidden');
    document.getElementById('pro-map-tabs').classList.add('hidden');
    document.getElementById('pro-toolbar').classList.add('hidden');
    
    if (isFinished) {
        stopTimer();
        document.getElementById('draft-phase').innerText = "DRAFT COMPLETE";
        document.getElementById('draft-action').innerText = "Result";
        document.getElementById('draft-timer').innerText = "";
        mainApp.className = ""; // Remove active glows
        document.getElementById('final-actions').classList.remove('hidden');
    } else {
        const turn = NORMAL_TURN_SEQUENCE[state.turnIndex];
        document.getElementById('draft-phase').innerText = turn.phase;
        document.getElementById('draft-action').innerText = turn.team === 1 ? `${state.team1Name} ${turn.type.toUpperCase()}` : `${state.team2Name} ${turn.type.toUpperCase()}`;
        mainApp.className = `app-active-t${turn.team}`;
        
        if (turn.type === 'pick') {
            document.getElementById('role-selector').classList.remove('hidden');
        }
        startTimer();
    }

    renderAgentGridNormal();
    renderSidePanelsNormal();
}

function renderAgentGridNormal() {
    const grid = document.getElementById('agent-grid');
    grid.innerHTML = '';
    
    AGENT_POOL.forEach(agent => {
        const div = document.createElement('div');
        div.className = 'agent-card';
        div.innerHTML = `<div class="name">${agent.name}</div><div class="role">${agent.role}</div>`;
        
        const isBanned = appState.normal.bans.some(b => b.agent === agent.name);
        const isPicked = appState.normal.picks.some(p => p.agent === agent.name);
        
        if (isBanned) div.classList.add('banned');
        if (isPicked) div.classList.add('picked');
        
        if (!isBanned && !isPicked && appState.normal.turnIndex < NORMAL_TURN_SEQUENCE.length) {
            const turn = NORMAL_TURN_SEQUENCE[appState.normal.turnIndex];
            if (turn.type === 'ban') {
                div.onclick = () => openModal(agent.name, 'ban', () => executeNormalBan(agent.name));
            }
        }
        grid.appendChild(div);
    });
}

function renderSidePanelsNormal() {
    const s = appState.normal;
    // T1 Picks & Bans
    let t1PicksHTML = '', t1BansHTML = '';
    let t2PicksHTML = '', t2BansHTML = '';
    
    for(let i=0; i<5; i++) {
        const p1 = s.picks.filter(p => p.team === 1)[i];
        const p2 = s.picks.filter(p => p.team === 2)[i];
        t1PicksHTML += `<div class="pick-slot">${p1 ? p1.agent : ''}</div>`;
        t2PicksHTML += `<div class="pick-slot">${p2 ? p2.agent : ''}</div>`;
    }
    
    s.bans.filter(b=>b.team===1).forEach(b => t1BansHTML += `<div class="ban-slot">${b.agent}</div>`);
    s.bans.filter(b=>b.team===2).forEach(b => t2BansHTML += `<div class="ban-slot">${b.agent}</div>`);
    
    document.getElementById('picks-t1').innerHTML = t1PicksHTML;
    document.getElementById('picks-t2').innerHTML = t2PicksHTML;
    document.getElementById('bans-t1').innerHTML = t1BansHTML;
    document.getElementById('bans-t2').innerHTML = t2BansHTML;
}

function executeNormalBan(agentName) {
    closeModal();
    const turn = NORMAL_TURN_SEQUENCE[appState.normal.turnIndex];
    appState.normal.bans.push({ team: turn.team, agent: agentName });
    appState.normal.turnIndex++;
    updateNormalDraftUI();
}

function selectRole(role) {
    appState.normal.selectedRole = role;
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

function startRandomRoll() {
    const role = appState.normal.selectedRole;
    let available = AGENT_POOL.filter(a => 
        !appState.normal.bans.some(b => b.agent === a.name) &&
        !appState.normal.picks.some(p => p.agent === a.name)
    );
    if (role !== 'Any') {
        available = available.filter(a => a.role === role);
    }
    
    if (available.length === 0) {
        showToast(`No available agents in ${role}!`);
        return;
    }

    switchView('animation');
    const display = document.getElementById('anim-display');
    document.getElementById('anim-title').innerText = "ROLLING AGENT...";
    
    let rollCount = 0;
    let intervalTime = 80;
    
    const roll = () => {
        display.innerText = available[Math.floor(Math.random() * available.length)].name;
        rollCount++;
        
        if (rollCount < 20) {
            setTimeout(roll, intervalTime);
        } else if (rollCount < 30) {
            intervalTime += 50;
            setTimeout(roll, intervalTime);
        } else {
            const finalAgent = available[Math.floor(Math.random() * available.length)].name;
            display.innerText = finalAgent;
            display.classList.add('anim-pulse');
            
            setTimeout(() => {
                display.classList.remove('anim-pulse');
                executeNormalPick(finalAgent);
                switchView('draft');
            }, 2000);
        }
    };
    roll();
}

function executeNormalPick(agentName) {
    const turn = NORMAL_TURN_SEQUENCE[appState.normal.turnIndex];
    appState.normal.picks.push({ team: turn.team, agent: agentName });
    appState.normal.turnIndex++;
    updateNormalDraftUI();
}

function copyNormalResult() {
    const s = appState.normal;
    let txt = `VALORANT DRAFT RESULT\nMAP: ${s.map}\n\n`;
    txt += `${s.team1Name}:\n` + s.picks.filter(p=>p.team===1).map(p=>p.agent).join('\n') + `\n\n`;
    txt += `${s.team2Name}:\n` + s.picks.filter(p=>p.team===2).map(p=>p.agent).join('\n') + `\n\n`;
    txt += `${s.team1Name} BANS:\n` + s.bans.filter(b=>b.team===1).map(b=>b.agent).join('\n') + `\n\n`;
    txt += `${s.team2Name} BANS:\n` + s.bans.filter(b=>b.team===2).map(b=>b.agent).join('\n');
    
    navigator.clipboard.writeText(txt).then(() => showToast('Draft result copied!'));
}

// ============================================================================
// PROFESSIONAL MODE ENGINE
// ============================================================================
function renderProSetup() {
    appState.pro = getInitialState().pro;
    document.getElementById('pro-team-1').value = "";
    document.getElementById('pro-team-2').value = "";
    setProFormat('BO1');
    renderProMapPoolSetup();
}

function setProFormat(format) {
    appState.pro.format = format;
    document.querySelectorAll('#format-toggles .toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText === format);
    });
}

function renderProMapPoolSetup() {
    const grid = document.getElementById('pro-map-grid');
    grid.innerHTML = '';
    ALL_MAPS.forEach(m => {
        const div = document.createElement('div');
        div.className = 'map-card';
        if (appState.pro.pool.includes(m)) div.classList.add('selected');
        div.innerText = m;
        div.onclick = () => {
            if (appState.pro.pool.includes(m)) {
                appState.pro.pool = appState.pro.pool.filter(x => x !== m);
            } else if (appState.pro.pool.length < 7) {
                appState.pro.pool.push(m);
            }
            document.getElementById('map-pool-count').innerText = appState.pro.pool.length;
            document.getElementById('start-pro-btn').disabled = appState.pro.pool.length !== 7;
            renderProMapPoolSetup();
        };
        grid.appendChild(div);
    });
}

function startProCoinToss() {
    appState.pro.team1Name = document.getElementById('pro-team-1').value.trim() || "Team 1";
    appState.pro.team2Name = document.getElementById('pro-team-2').value.trim() || "Team 2";
    
    switchView('animation');
    const display = document.getElementById('anim-display');
    document.getElementById('anim-title').innerText = "COIN TOSS...";
    
    let rollCount = 0;
    const t1 = appState.pro.team1Name;
    const t2 = appState.pro.team2Name;
    
    const roll = () => {
        display.innerText = rollCount % 2 === 0 ? t1 : t2;
        rollCount++;
        if (rollCount < 20) {
            setTimeout(roll, 150);
        } else {
            const winner = Math.random() > 0.5 ? 1 : 2;
            appState.pro.coinWinner = winner;
            display.innerText = winner === 1 ? t1 : t2;
            display.classList.add('anim-pulse');
            document.getElementById('anim-title').innerText = "WINNER (FIRST BAN):";
            
            setTimeout(() => {
                display.classList.remove('anim-pulse');
                startProMapDraft();
            }, 2500);
        }
    };
    roll();
}

function saveProUndoState() {
    appState.proUndoStack.push(JSON.stringify(appState.pro));
}

function undoProAction() {
    if (appState.proUndoStack.length > 0) {
        appState.pro = JSON.parse(appState.proUndoStack.pop());
        if (appState.mode === 'pro_map_draft') renderProMapDraft();
        if (appState.mode === 'pro_agent_draft') updateProAgentDraftUI();
    }
}

function startProMapDraft() {
    appState.mode = 'pro_map_draft';
    appState.pro.mapDraftStep = 0;
    appState.pro.mapDraftLog = [];
    appState.pro.finalMaps = [];
    appState.proUndoStack = [];
    switchView('pro-map-draft');
    renderProMapDraft();
}

function renderProMapDraft() {
    const s = appState.pro;
    const seq = PRO_MAP_SEQUENCES[s.format];
    const isFinished = s.mapDraftStep >= seq.length;
    
    document.getElementById('pro-side-selection').classList.add('hidden');
    document.getElementById('pro-active-map-grid').classList.remove('hidden');
    
    if (isFinished) {
        stopTimer();
        document.getElementById('pro-map-action-title').innerText = "MAP DRAFT COMPLETE";
        document.getElementById('pro-map-timer').innerText = "";
        document.getElementById('pro-active-map-grid').classList.add('hidden');
        document.getElementById('pro-map-summary').classList.remove('hidden');
        
        let summaryHTML = '';
        s.finalMaps.forEach((fm, idx) => {
            summaryHTML += `<div class="summary-card">
                <div>MAP ${idx+1}</div>
                <div class="map">${fm.name}</div>
                ${fm.atkTeam ? `<div>${fm.atkTeam} ATK<br>${fm.defTeam} DEF</div>` : `<div>DECIDER</div>`}
            </div>`;
        });
        document.getElementById('pro-summary-cards').innerHTML = summaryHTML;
        return;
    }

    const step = seq[s.mapDraftStep];
    let activeTeamNum = step.team === 1 ? s.coinWinner : (s.coinWinner === 1 ? 2 : 1);
    if (step.team === 'auto' || step.team === 'random') activeTeamNum = 0;
    
    const activeTeamName = activeTeamNum === 1 ? s.team1Name : (activeTeamNum === 2 ? s.team2Name : "SYSTEM");

    if (step.action === 'ban' || step.action === 'pick') {
        document.getElementById('pro-map-action-title').innerText = `${activeTeamName} - ${step.action.toUpperCase()} A MAP`;
    } else if (step.action === 'side') {
        document.getElementById('pro-map-action-title').innerText = `${activeTeamName} - CHOOSE STARTING SIDE`;
        document.getElementById('pro-active-map-grid').classList.add('hidden');
        document.getElementById('pro-side-selection').classList.remove('hidden');
    } else if (step.action === 'decider') {
        handleProDeciderMap();
        return;
    }

    // Render remaining maps
    const grid = document.getElementById('pro-active-map-grid');
    grid.innerHTML = '';
    s.pool.forEach(m => {
        const div = document.createElement('div');
        div.className = 'map-card';
        div.innerText = m;
        
        const isBanned = s.mapDraftLog.some(l => l.action === 'ban' && l.map === m);
        const isPicked = s.mapDraftLog.some(l => l.action === 'pick' && l.map === m);
        
        if (isBanned) div.classList.add('banned');
        if (isPicked) div.classList.add('picked');
        
        if (!isBanned && !isPicked && (step.action === 'ban' || step.action === 'pick')) {
            div.onclick = () => {
                saveProUndoState();
                s.mapDraftLog.push({ action: step.action, map: m });
                if (step.action === 'pick') {
                    s.finalMaps.push({ name: m, atkTeam: null, defTeam: null, bans: [], picks: [], turnIndex: 0 });
                }
                s.mapDraftStep++;
                renderProMapDraft();
            };
        }
        grid.appendChild(div);
    });

    startTimer('pro-map-timer');
}

function handleProSideSelection(sideChoice) {
    saveProUndoState();
    const s = appState.pro;
    const seq = PRO_MAP_SEQUENCES[s.format];
    const step = seq[s.mapDraftStep];
    
    let activeTeamNum = step.team === 1 ? s.coinWinner : (s.coinWinner === 1 ? 2 : 1);
    let selectingTeam = activeTeamNum === 1 ? s.team1Name : s.team2Name;
    let otherTeam = activeTeamNum === 1 ? s.team2Name : s.team1Name;
    
    // Find latest map picked or decider
    const latestMap = s.finalMaps[s.finalMaps.length - 1];
    
    if (step.team === 'random') {
        selectingTeam = Math.random() > 0.5 ? s.team1Name : s.team2Name;
        otherTeam = selectingTeam === s.team1Name ? s.team2Name : s.team1Name;
        sideChoice = Math.random() > 0.5 ? 'Attack' : 'Defense';
    }

    if (sideChoice === 'Attack') {
        latestMap.atkTeam = selectingTeam;
        latestMap.defTeam = otherTeam;
    } else {
        latestMap.defTeam = selectingTeam;
        latestMap.atkTeam = otherTeam;
    }
    
    s.mapDraftStep++;
    renderProMapDraft();
}

function handleProDeciderMap() {
    saveProUndoState();
    const s = appState.pro;
    const usedMaps = s.mapDraftLog.map(l => l.map);
    const decider = s.pool.find(m => !usedMaps.includes(m));
    s.mapDraftLog.push({ action: 'pick', map: decider });
    s.finalMaps.push({ name: decider, atkTeam: null, defTeam: null, bans: [], picks: [], turnIndex: 0 });
    s.mapDraftStep++;
    renderProMapDraft();
}

// Pro Agent Draft
function enterProAgentDraft() {
    appState.mode = 'pro_agent_draft';
    appState.pro.activeMapIndex = 0;
    switchView('draft');
    updateProAgentDraftUI();
}

function updateProAgentDraftUI() {
    const s = appState.pro;
    const mapData = s.finalMaps[s.activeMapIndex];
    const isFinished = mapData.turnIndex >= NORMAL_TURN_SEQUENCE.length;

    // Render Tabs
    const tabsContainer = document.getElementById('pro-map-tabs');
    tabsContainer.classList.remove('hidden');
    document.getElementById('pro-toolbar').classList.remove('hidden');
    tabsContainer.innerHTML = '';
    s.finalMaps.forEach((fm, idx) => {
        const btn = document.createElement('button');
        btn.className = `map-tab ${idx === s.activeMapIndex ? 'active' : ''}`;
        btn.innerText = `Map ${idx+1}: ${fm.name}`;
        btn.onclick = () => { s.activeMapIndex = idx; updateProAgentDraftUI(); };
        tabsContainer.appendChild(btn);
    });

    // In Pro mode, Team 1 = Attack, Team 2 = Defense for draft order logic
    // Ranked logic: Attack (Team 1) bans first. Defense (Team 2) drafts second.
    // If Atk/Def is not set (e.g., BO1 early decider without side yet, fallback to coin winner)
    const leftTeam = mapData.atkTeam || s.team1Name;
    const rightTeam = mapData.defTeam || s.team2Name;

    document.getElementById('name-t1').innerText = leftTeam + " (ATK)";
    document.getElementById('name-t2').innerText = rightTeam + " (DEF)";
    document.getElementById('draft-map-name').innerText = mapData.name;
    document.getElementById('roster-t1').innerHTML = "";
    document.getElementById('roster-t2').innerHTML = "";
    document.getElementById('role-selector').classList.add('hidden');
    document.getElementById('agent-search-bar').classList.remove('hidden');
    document.getElementById('final-actions').classList.add('hidden');

    const mainApp = document.getElementById('app-main');
    
    if (isFinished) {
        stopTimer();
        document.getElementById('draft-phase').innerText = "DRAFT COMPLETE";
        document.getElementById('draft-action').innerText = "";
        document.getElementById('draft-timer').innerText = "";
        mainApp.className = "";
    } else {
        const turn = NORMAL_TURN_SEQUENCE[mapData.turnIndex];
        const activeName = turn.team === 1 ? leftTeam : rightTeam;
        document.getElementById('draft-phase').innerText = turn.phase;
        document.getElementById('draft-action').innerText = `${activeName} - ${turn.type.toUpperCase()}`;
        mainApp.className = `app-active-t${turn.team}`;
        startTimer();
    }

    renderAgentGridPro();
    renderSidePanelsPro();
}

function filterAgents() {
    appState.pro.searchQuery = document.getElementById('agent-search-input').value.toLowerCase();
    appState.pro.roleFilter = document.getElementById('agent-role-filter').value;
    if (appState.mode === 'pro_agent_draft') renderAgentGridPro();
}

function renderAgentGridPro() {
    const grid = document.getElementById('agent-grid');
    grid.innerHTML = '';
    const mapData = appState.pro.finalMaps[appState.pro.activeMapIndex];
    
    AGENT_POOL.forEach(agent => {
        if (appState.pro.roleFilter !== 'All' && agent.role !== appState.pro.roleFilter) return;
        if (appState.pro.searchQuery && !agent.name.toLowerCase().includes(appState.pro.searchQuery)) return;

        const div = document.createElement('div');
        div.className = 'agent-card';
        div.innerHTML = `<div class="name">${agent.name}</div><div class="role">${agent.role}</div>`;
        
        const isBanned = mapData.bans.some(b => b.agent === agent.name);
        const isPicked = mapData.picks.some(p => p.agent === agent.name);
        
        if (isBanned) div.classList.add('banned');
        if (isPicked) div.classList.add('picked');
        
        if (!isBanned && !isPicked && mapData.turnIndex < NORMAL_TURN_SEQUENCE.length) {
            const turn = NORMAL_TURN_SEQUENCE[mapData.turnIndex];
            div.onclick = () => openModal(agent.name, turn.type, () => executeProAction(agent.name, turn.type, turn.team));
        }
        grid.appendChild(div);
    });
}

function renderSidePanelsPro() {
    const mapData = appState.pro.finalMaps[appState.pro.activeMapIndex];
    let t1PicksHTML = '', t1BansHTML = '';
    let t2PicksHTML = '', t2BansHTML = '';
    
    for(let i=0; i<5; i++) {
        const p1 = mapData.picks.filter(p => p.team === 1)[i];
        const p2 = mapData.picks.filter(p => p.team === 2)[i];
        t1PicksHTML += `<div class="pick-slot">${p1 ? p1.agent : ''}</div>`;
        t2PicksHTML += `<div class="pick-slot">${p2 ? p2.agent : ''}</div>`;
    }
    
    mapData.bans.filter(b=>b.team===1).forEach(b => t1BansHTML += `<div class="ban-slot">${b.agent}</div>`);
    mapData.bans.filter(b=>b.team===2).forEach(b => t2BansHTML += `<div class="ban-slot">${b.agent}</div>`);
    
    document.getElementById('picks-t1').innerHTML = t1PicksHTML;
    document.getElementById('picks-t2').innerHTML = t2PicksHTML;
    document.getElementById('bans-t1').innerHTML = t1BansHTML;
    document.getElementById('bans-t2').innerHTML = t2BansHTML;
}

function executeProAction(agentName, type, team) {
    saveProUndoState();
    closeModal();
    const mapData = appState.pro.finalMaps[appState.pro.activeMapIndex];
    if (type === 'ban') {
        mapData.bans.push({ team, agent: agentName });
    } else {
        mapData.picks.push({ team, agent: agentName });
    }
    mapData.turnIndex++;
    updateProAgentDraftUI();
}

function copyProResult() {
    const s = appState.pro;
    let txt = `VALORANT PROFESSIONAL SERIES RESULT\nTEAMS:\n${s.team1Name} vs ${s.team2Name}\n\n`;
    txt += `FORMAT:\n${s.format}\n\nMAP POOL:\n${s.pool.join(', ')}\n\n`;
    txt += `COIN TOSS WINNER:\n${s.coinWinner === 1 ? s.team1Name : s.team2Name}\n\n`;

    s.finalMaps.forEach((fm, idx) => {
        txt += `MAP ${idx+1}:\n${fm.name.toUpperCase()}\n`;
        if (fm.atkTeam) {
            txt += `${fm.atkTeam} ATK / ${fm.defTeam} DEF\n`;
        } else {
            txt += `DECIDER\n`;
        }
        
        const leftTeam = fm.atkTeam || s.team1Name;
        const rightTeam = fm.defTeam || s.team2Name;
        
        txt += `${leftTeam} BANS: ` + fm.bans.filter(b=>b.team===1).map(b=>b.agent).join(', ') + `\n`;
        txt += `${rightTeam} BANS: ` + fm.bans.filter(b=>b.team===2).map(b=>b.agent).join(', ') + `\n`;
        txt += `${leftTeam} PICKS: ` + fm.picks.filter(p=>p.team===1).map(p=>p.agent).join(', ') + `\n`;
        txt += `${rightTeam} PICKS: ` + fm.picks.filter(p=>p.team===2).map(p=>p.agent).join(', ') + `\n\n`;
    });

    navigator.clipboard.writeText(txt.trim()).then(() => showToast('Series result copied!'));
}

// ============================================================================
// TIMERS & MODALS
// ============================================================================
function startTimer(elementId = 'draft-timer') {
    stopTimer();
    let timeLeft = 50;
    const el = document.getElementById(elementId);
    el.classList.remove('expired');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            stopTimer();
            el.innerText = "Time Expired";
            el.classList.add('expired');
        } else {
            el.innerText = `00:${timeLeft < 10 ? '0' : ''}${timeLeft}`;
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById('draft-timer').innerText = "00:50";
    document.getElementById('pro-map-timer').innerText = "00:50";
}

function openModal(agentName, actionType, confirmCallback) {
    document.getElementById('modal-title').innerText = `Confirm ${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`;
    document.getElementById('modal-agent-name').innerText = agentName;
    document.getElementById('modal-confirm-btn').onclick = confirmCallback;
    document.getElementById('confirm-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('confirm-modal').classList.remove('active');
}
