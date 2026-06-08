// --- CONSTANTS DATA ---
const MAP_POOL = [
    "CORRODE", "Haven", "Icebox", "Split", "Pearl", "Bind", 
    "Fracture", "Breeze", "Abyss", "Sunset", "Lotus", "Ascent"
];

const AGENT_ROLES = {
    Duelist: ["Jett", "Raze", "Reyna", "Phoenix", "Yoru", "Neon", "Iso", "Waylay"],
    Initiator: ["Sova", "Fade", "Skye", "Gekko", "Breach", "KAY/O", "Tejo"],
    Controller: ["Astra", "Brimstone", "Clove", "Harbor", "Miks", "Omen", "Viper"],
    Sentinels: ["Chamber", "Cypher", "Deadlock", "Killjoy", "Sage", "Veto", "Vyse"]
};

let ALL_AGENTS = [];
for (let role in AGENT_ROLES) {
    ALL_AGENTS = ALL_AGENTS.concat(AGENT_ROLES[role]);
}

// --- STATE MANAGEMENT ---
let appState = {
    mode: "start", 
    players: {
        team1: ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"],
        team2: ["Player 6", "Player 7", "Player 8", "Player 9", "Player 10"]
    },
    selectedMap: "",
    sides: { team1: "", team2: "" }, // Quản lý phe (ATK/DEF) của 2 team
    bannedAgents: { team1: [], team2: [] },
    pickedAgents: {
        team1: [null, null, null, null, null],
        team2: [null, null, null, null, null]
    },
    currentTurnIndex: 0,
    selectedRoleFilter: "All", 
    isRolling: false
};

// --- CHUỖI BAN/PICK THEO LUẬT TOURNAMENT ĐÃ SỬA ĐỔI ---
const DRAFT_SEQUENCE = [
    // Giai đoạn 1: Ban 4 Agent đầu tiên
    { type: "ban", team: 1, index: 0, label: "TEAM 1 BAN - ROUND 1" },
    { type: "ban", team: 2, index: 0, label: "TEAM 2 BAN - ROUND 1" },
    { type: "ban", team: 1, index: 1, label: "TEAM 1 BAN - ROUND 2" },
    { type: "ban", team: 2, index: 1, label: "TEAM 2 BAN - ROUND 2" },
    
    // Giai đoạn 2: Lượt Pick đầu tiên
    { type: "pick", team: 1, slot: 0, label: "TEAM 1 PICK - PLAYER 1" },
    
    { type: "pick", team: 2, slot: 0, label: "TEAM 2 PICK - PLAYER 1" },
    { type: "pick", team: 2, slot: 1, label: "TEAM 2 PICK - PLAYER 2" }, // Team 2 roll liền 2 Chợ
    
    { type: "pick", team: 1, slot: 1, label: "TEAM 1 PICK - PLAYER 2" },
    { type: "pick", team: 1, slot: 2, label: "TEAM 1 PICK - PLAYER 3" }, // Team 1 roll liền 2 Chợ
    
    { type: "pick", team: 2, slot: 2, label: "TEAM 2 PICK - PLAYER 3" },
    
    // Giai đoạn 3: Lượt Ban cuối cùng
    { type: "ban", team: 1, index: 2, label: "TEAM 1 BAN - FINAL ROUND" },
    { type: "ban", team: 2, index: 2, label: "TEAM 2 BAN - FINAL ROUND" },
    
    // Giai đoạn 4: Hoàn thành các lượt Pick còn lại
    { type: "pick", team: 2, slot: 3, label: "TEAM 2 PICK - PLAYER 4" },
    
    { type: "pick", team: 1, slot: 3, label: "TEAM 1 PICK - PLAYER 4" },
    { type: "pick", team: 1, slot: 4, label: "TEAM 1 PICK - PLAYER 5" }, // Team 1 roll liền 2 Chợ cuối
    
    { type: "pick", team: 2, slot: 4, label: "TEAM 2 PICK - PLAYER 5" }
];

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    initDOMEvents();
    renderPlayerInputFields();
});

function initDOMEvents() {
    document.getElementById("logo-btn").addEventListener("click", resetToHome);
    document.getElementById("btn-start-draft").addEventListener("click", () => startDraftFlow("start"));
    document.getElementById("btn-random-team").addEventListener("click", () => switchScreen("player-input-screen"));
    document.getElementById("btn-generate-teams").addEventListener("click", processRandomTeamGeneration);
    
    // Định tuyến chuỗi: Xác nhận Map xong chuyển sang Roll Phe (Sides)
    document.getElementById("btn-confirm-map").addEventListener("click", executeSideSelectionRoutine);
    document.getElementById("btn-confirm-side").addEventListener("click", proceedToBanPickPhase);
    
    document.getElementById("btn-trigger-roll").addEventListener("click", executeAgentRollRoutine);

    document.querySelectorAll(".role-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            if (appState.isRolling) return;
            document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            appState.selectedRoleFilter = e.target.getAttribute("data-role");
            renderAgentGrid();
        });
    });

    document.getElementById("btn-copy-result").addEventListener("click", copyDraftDataToClipboard);
    document.getElementById("btn-reset-draft").addEventListener("click", resetToHome);
}

function switchScreen(screenId) {
    document.querySelectorAll(".screen").forEach(scr => scr.classList.remove("active"));
    document.getElementById(screenId).classList.add("active");
}

function renderPlayerInputFields() {
    const container = document.querySelector(".player-grid-inputs");
    container.innerHTML = "";
    for (let i = 1; i <= 10; i++) {
        container.innerHTML += `
            <div class="input-group">
                <label>P${i}</label>
                <input type="text" id="p-input-${i}" value="PLAYER ${i}">
            </div>
        `;
    }
}

function processRandomTeamGeneration() {
    let rawNames = [];
    for (let i = 1; i <= 10; i++) {
        let val = document.getElementById(`p-input-${i}`).value.trim();
        rawNames.push(val === "" ? `PLAYER ${i}` : val.toUpperCase());
    }
    
    for (let i = rawNames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rawNames[i], rawNames[j]] = [rawNames[j], rawNames[i]];
    }

    appState.players.team1 = rawNames.slice(0, 5);
    appState.players.team2 = rawNames.slice(5, 10);
    
    startDraftFlow("random-team");
}

function startDraftFlow(mode) {
    appState.mode = mode;
    if (mode === "start") {
        appState.players.team1 = ["PLAYER 1", "PLAYER 2", "PLAYER 3", "PLAYER 4", "PLAYER 5"];
        appState.players.team2 = ["PLAYER 6", "PLAYER 7", "PLAYER 8", "PLAYER 9", "PLAYER 10"];
    }

    document.getElementById("header-match-info").classList.remove("hidden");
    switchScreen("draft-screen");

    refreshDraftPanelsUI();
    executeMapSelectionRoutine();
}

function executeMapSelectionRoutine() {
    document.getElementById("status-message").innerText = "SELECTING MATCH MAP...";
    const mapSection = document.getElementById("map-rolling-section");
    const sideSection = document.getElementById("side-rolling-section");
    const pickSection = document.getElementById("pick-control-section");
    const rollerBox = document.getElementById("map-roller-box");
    const confirmBtn = document.getElementById("btn-confirm-map");

    mapSection.classList.remove("hidden");
    sideSection.classList.add("hidden");
    pickSection.classList.add("hidden");
    confirmBtn.classList.add("hidden");

    let counter = 0;
    let interval = setInterval(() => {
        let randMap = MAP_POOL[Math.floor(Math.random() * MAP_POOL.length)];
        rollerBox.innerText = randMap;
        counter++;
        if (counter > 15) {
            clearInterval(interval);
            appState.selectedMap = MAP_POOL[Math.floor(Math.random() * MAP_POOL.length)];
            rollerBox.innerText = appState.selectedMap;
            document.getElementById("active-map-name").innerText = appState.selectedMap.toUpperCase();
            confirmBtn.classList.remove("hidden");
            document.getElementById("status-message").innerText = `MAP SELECTED: ${appState.selectedMap.toUpperCase()}`;
        }
    }, 100);
}

// ROUTINE LÀM MỚI: ROLL PHE (ATK/DEF) CHO HAI TEAM
function executeSideSelectionRoutine() {
    document.getElementById("map-rolling-section").classList.add("hidden");
    document.getElementById("status-message").innerText = "DETERMINING TEAM SIDES...";

    const sideSection = document.getElementById("side-rolling-section");
    const rollerBox = document.getElementById("side-roller-box");
    const confirmBtn = document.getElementById("btn-confirm-side");

    sideSection.classList.remove("hidden");
    confirmBtn.classList.add("hidden");

    const options = [
        { t1: "ATK", t2: "DEF", text: "T1: ATK ⚔️ DEF :T2" },
        { t1: "DEF", t2: "ATK", text: "T1: DEF 🛡️ ATK :T2" }
    ];

    let counter = 0;
    let interval = setInterval(() => {
        let randOpt = options[Math.floor(Math.random() * options.length)];
        rollerBox.innerText = randOpt.text;
        counter++;
        
        if (counter > 12) {
            clearInterval(interval);
            let finalOpt = options[Math.floor(Math.random() * options.length)];
            appState.sides.team1 = finalOpt.t1;
            appState.sides.team2 = finalOpt.t2;
            
            // Render kết quả có màu sắc trực quan
            rollerBox.innerHTML = `
                <span style="color: var(--v-red)">${finalOpt.t1}</span> 
                <span style="font-size: 24px; color: var(--v-gray)">VS</span> 
                <span style="color: var(--v-teal)">${finalOpt.t2}</span>
            `;
            
            confirmBtn.classList.remove("hidden");
            document.getElementById("status-message").innerText = `SIDES SET | TEAM 1: ${finalOpt.t1} • TEAM 2: ${finalOpt.t2}`;
            
            // Cập nhật nhãn bên cạnh tiêu đề Panel hai bên để dễ nhìn nhận
            document.getElementById("t1-display-name").innerText = `TEAM 1 (${finalOpt.t1})`;
            document.getElementById("t2-display-name").innerText = `TEAM 2 (${finalOpt.t2})`;
        }
    }, 100);
}

function proceedToBanPickPhase() {
    document.getElementById("side-rolling-section").classList.add("hidden");
    document.getElementById("pick-control-section").classList.remove("hidden");
    appState.currentTurnIndex = 0;
    processCurrentTurnStep();
}

function processCurrentTurnStep() {
    if (appState.currentTurnIndex >= DRAFT_SEQUENCE.length) {
        finishDraftAndShowResults();
        return;
    }

    const currentStep = DRAFT_SEQUENCE[appState.currentTurnIndex];
    document.getElementById("status-message").innerText = currentStep.label;

    const t1Panel = document.getElementById("team1-panel");
    const t2Panel = document.getElementById("team2-panel");
    t1Panel.classList.remove("active-turn");
    t2Panel.classList.remove("active-turn");

    if (currentStep.team === 1) t1Panel.classList.add("active-turn");
    else t2Panel.classList.add("active-turn");

    const rollZone = document.querySelector(".roll-zone");
    const roleSelector = document.getElementById("role-buttons-container");
    const instructionText = document.querySelector(".instruction");
    const poolTitle = document.getElementById("pool-title");

    if (currentStep.type === "ban") {
        rollZone.classList.add("hidden");
        roleSelector.classList.add("hidden");
        instructionText.innerText = "CLICK AN AGENT IN THE POOL BELOW TO BAN THEM";
        poolTitle.innerText = "CLICK TO BAN AGENT";
    } else {
        rollZone.classList.remove("hidden");
        roleSelector.classList.remove("hidden");
        instructionText.innerText = "Select a role preference before rolling for an agent:";
        poolTitle.innerText = "ELIGIBLE AGENT POOL";
        document.getElementById("agent-roller-box").innerText = "?";
    }

    renderAgentGrid();
    refreshDraftPanelsUI();
}

function renderAgentGrid() {
    const grid = document.getElementById("main-agent-grid");
    grid.innerHTML = "";

    const currentStep = DRAFT_SEQUENCE[appState.currentTurnIndex];
    if (!currentStep) return;

    let targetPool = [];
    if (currentStep.type === "pick" && appState.selectedRoleFilter !== "All") {
        targetPool = AGENT_ROLES[appState.selectedRoleFilter];
    } else {
        targetPool = ALL_AGENTS;
    }

    targetPool.forEach(agent => {
        const isBanned = appState.bannedAgents.team1.includes(agent) || appState.bannedAgents.team2.includes(agent);
        const isPicked = appState.pickedAgents.team1.includes(agent) || appState.pickedAgents.team2.includes(agent);
        
        const card = document.createElement("div");
        card.className = "agent-card";
        card.innerText = agent;

        if (isBanned || isPicked) {
            card.classList.add("disabled");
        } else if (currentStep.type === "ban") {
            card.classList.add("clickable-ban");
            card.addEventListener("click", () => handleBanAction(agent));
        }

        grid.appendChild(card);
    });
}

function handleBanAction(agentName) {
    const currentStep = DRAFT_SEQUENCE[appState.currentTurnIndex];
    if (!currentStep || currentStep.type !== "ban") return;

    if (currentStep.team === 1) {
        appState.bannedAgents.team1.push(agentName);
    } else {
        appState.bannedAgents.team2.push(agentName);
    }

    appState.currentTurnIndex++;
    processCurrentTurnStep();
}

function executeAgentRollRoutine() {
    if (appState.isRolling) return;

    const currentStep = DRAFT_SEQUENCE[appState.currentTurnIndex];
    if (!currentStep || currentStep.type !== "pick") return;

    let validPool = [];
    if (appState.selectedRoleFilter === "All") {
        validPool = ALL_AGENTS;
    } else {
        validPool = AGENT_ROLES[appState.selectedRoleFilter];
    }

    validPool = validPool.filter(agent => {
        return !appState.bannedAgents.team1.includes(agent) &&
               !appState.bannedAgents.team2.includes(agent) &&
               !appState.pickedAgents.team1.includes(agent) &&
               !appState.pickedAgents.team2.includes(agent);
    });

    if (validPool.length === 0) {
        alert("No available agents left in this role! Please choose another role or select ANY ROLE.");
        return;
    }

    appState.isRolling = true;
    const rollerBox = document.getElementById("agent-roller-box");
    rollerBox.classList.add("rolling");

    let counter = 0;
    let rollInterval = setInterval(() => {
        let tempAgent = validPool[Math.floor(Math.random() * validPool.length)];
        rollerBox.innerText = tempAgent;
        counter++;

        if (counter > 18) {
            clearInterval(rollInterval);
            rollerBox.classList.remove("rolling");
            
            const finalAgent = validPool[Math.floor(Math.random() * validPool.length)];
            rollerBox.innerText = finalAgent;

            if (currentStep.team === 1) {
                appState.pickedAgents.team1[currentStep.slot] = finalAgent;
            } else {
                appState.pickedAgents.team2[currentStep.slot] = finalAgent;
            }

            appState.isRolling = false;
            appState.currentTurnIndex++;
            
            setTimeout(processCurrentTurnStep, 800);
        }
    }, 70);
}

function refreshDraftPanelsUI() {
    updateTeamPanelDOM("1", appState.players.team1, appState.pickedAgents.team1, appState.bannedAgents.team1);
    updateTeamPanelDOM("2", appState.players.team2, appState.pickedAgents.team2, appState.bannedAgents.team2);
}

function updateTeamPanelDOM(teamNum, playersArr, picksArr, bansArr) {
    const slotsContainer = document.getElementById(`t${teamNum}-slots`);
    slotsContainer.innerHTML = "";

    for (let i = 0; i < 5; i++) {
        const pName = playersArr[i] || `PLAYER ${i+1}`;
        const agentName = picksArr[i];
        
        const isPicked = agentName !== null;
        const displayAgent = isPicked ? agentName : "WAITING...";
        const classPicked = isPicked ? "picked" : "";

        slotsContainer.innerHTML += `
            <div class="p-slot ${classPicked}">
                <div class="slot-info">
                    <span class="slot-pname">${pName}</span>
                    <span class="slot-aname">${displayAgent}</span>
                </div>
                <div class="slot-avatar-placeholder">${isPicked ? agentName.substring(0,3) : "?"}</div>
            </div>
        `;
    }

    const bansContainer = document.getElementById(`t${teamNum}-bans`);
    bansContainer.innerHTML = "";
    for (let i = 0; i < 3; i++) {
        const bannedAgent = bansArr[i];
        if (bannedAgent) {
            bansContainer.innerHTML += `<div class="b-slot banned">${bannedAgent.substring(0,3)}</div>`;
        } else {
            bansContainer.innerHTML += `<div class="b-slot">-</div>`;
        }
    }
}

function finishDraftAndShowResults() {
    switchScreen("result-screen");
    document.getElementById("header-match-info").classList.add("hidden");

    document.getElementById("res-map-name").innerText = appState.selectedMap.toUpperCase();

    // Kết xuất phe ATK/DEF lên màn hình tổng kết
    document.getElementById("res-t1-title").innerText = `TEAM 1 (${appState.sides.team1})`;
    document.getElementById("res-t2-title").innerText = `TEAM 2 (${appState.sides.team2})`;

    const t1List = document.getElementById("res-t1-picks");
    t1List.innerHTML = "";
    appState.pickedAgents.team1.forEach((agent, i) => {
        t1List.innerHTML += `<li><span>${appState.players.team1[i]}</span> <strong>${agent}</strong></li>`;
    });

    const t2List = document.getElementById("res-t2-picks");
    t2List.innerHTML = "";
    appState.pickedAgents.team2.forEach((agent, i) => {
        t2List.innerHTML += `<li><span>${appState.players.team2[i]}</span> <strong>${agent}</strong></li>`;
    });

    document.getElementById("res-t1-bans").innerText = appState.bannedAgents.team1.join(", ") || "None";
    document.getElementById("res-t2-bans").innerText = appState.bannedAgents.team2.join(", ") || "None";
}

function copyDraftDataToClipboard() {
    let text = `VALORANT DRAFT RESULT\n\n`;
    text += `MAP: ${appState.selectedMap}\n`;
    text += `TEAM 1 SIDE: ${appState.sides.team1} | TEAM 2 SIDE: ${appState.sides.team2}\n\n`;
    
    text += `TEAM 1 (Picks):\n`;
    appState.pickedAgents.team1.forEach((agent, i) => text += `- ${appState.players.team1[i]}: ${agent}\n`);
    
    text += `\nTEAM 2 (Picks):\n`;
    appState.pickedAgents.team2.forEach((agent, i) => text += `- ${appState.players.team2[i]}: ${agent}\n`);
    
    text += `\nTEAM 1 BANS: ${appState.bannedAgents.team1.join(", ") || "None"}\n`;
    text += `TEAM 2 BANS: ${appState.bannedAgents.team2.join(", ") || "None"}\n`;

    navigator.clipboard.writeText(text).then(() => {
        alert("Draft results successfully copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy text: ", err);
    });
}

function resetToHome() {
    if (appState.isRolling) return;

    appState.selectedMap = "";
    appState.sides = { team1: "", team2: "" };
    appState.bannedAgents = { team1: [], team2: [] };
    appState.pickedAgents = {
        team1: [null, null, null, null, null],
        team2: [null, null, null, null, null]
    };
    appState.currentTurnIndex = 0;
    appState.selectedRoleFilter = "All";

    document.getElementById("t1-display-name").innerText = "TEAM 1";
    document.getElementById("t2-display-name").innerText = "TEAM 2";

    document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
    document.querySelector("[data-role='All']").classList.add("active");

    document.getElementById("header-match-info").classList.add("hidden");
    document.getElementById("side-rolling-section").classList.add("hidden");
    switchScreen("home-screen");
}