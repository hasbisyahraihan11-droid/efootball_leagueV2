
const SUPABASE_URL = "https://krhtqhjyzfaeqeytuzyp.supabase.co/rest/v1/";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YBzD07cNtBLPuBrV2mJCTA_zg8zF_h9";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const STORAGE_KEY = "efootball_league_champion_v1";

const defaultData = {
  teams: [],
  fixtures: [],
  finished: false
};

let league = loadData();

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      return {
        ...defaultData,
        ...JSON.parse(saved)
      };
    }
  } catch (error) {
    console.error("Gagal membaca data liga:", error);
  }

  return {
    teams: [],
    fixtures: [],
    finished: false
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(league));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function teamById(id) {
  return league.teams.find(team => team.id === id);
}

function getStandings() {
  const standings = league.teams.map(team => ({
    ...team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0
  }));

  league.fixtures
    .filter(match => match.played)
    .forEach(match => {
      const home = standings.find(team => team.id === match.homeId);
      const away = standings.find(team => team.id === match.awayId);

      if (!home || !away) return;

      home.played++;
      away.played++;

      home.gf += match.homeScore;
      home.ga += match.awayScore;

      away.gf += match.awayScore;
      away.ga += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.wins++;
        home.points += 3;
        away.losses++;
      } else if (match.homeScore < match.awayScore) {
        away.wins++;
        away.points += 3;
        home.losses++;
      } else {
        home.draws++;
        away.draws++;
        home.points++;
        away.points++;
      }
    });

  standings.forEach(team => {
    team.gd = team.gf - team.ga;
  });

  standings.sort((a, b) =>
    b.points - a.points ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name)
  );

  return standings;
}

function renderTable(targetId, limit = Infinity) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const standings = getStandings().slice(0, limit);

  if (!standings.length) {
    target.innerHTML = `
      <tr>
        <td colspan="10">Belum ada klub yang terdaftar.</td>
      </tr>
    `;
    return;
  }

  target.innerHTML = standings.map((team, index) => `
    <tr>
      <td class="rank">${index + 1}</td>
      <td>
        <div class="club-name">
          <span class="club-emoji">${escapeHTML(team.logo)}</span>
          ${escapeHTML(team.name)}
        </div>
      </td>
      <td>${team.played}</td>
      <td>${team.wins}</td>
      <td>${team.draws}</td>
      <td>${team.losses}</td>
      <td>${team.gf}:${team.ga}</td>
      ${targetId === "fullLeagueTable"
        ? `<td>${team.ga}</td>`
        : ""}
      <td>${team.gd > 0 ? "+" : ""}${team.gd}</td>
      <td class="points">${team.points}</td>
    </tr>
  `).join("");
}

function renderPodium() {
  const podium = document.getElementById("podium");
  if (!podium) return;

  const standings = getStandings();

  if (!standings.length) {
    podium.innerHTML = `
      <div class="empty">
        Tambahkan klub melalui panel admin.
      </div>
    `;
    return;
  }

  const positions = [
    { team: standings[1], rank: 2, className: "second" },
    { team: standings[0], rank: 1, className: "first" },
    { team: standings[2], rank: 3, className: "third" }
  ].filter(item => item.team);

  podium.innerHTML = positions.map(item => `
    <div class="podium-card ${item.className}">
      <span class="podium-rank">#${item.rank}</span>
      <div class="podium-logo">${escapeHTML(item.team.logo)}</div>
      <h3>${escapeHTML(item.team.name)}</h3>
      <p>${item.team.points} Poin</p>
    </div>
  `).join("");
}

function renderChampion() {
  const standings = getStandings();
  const winner = standings[0];
  const champion = league.finished && winner;

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText("heroLogo", champion ? winner.logo : "🏆");
  setText("heroWinner", champion ? winner.name.toUpperCase() : "BELUM ADA JUARA");

  setText("profileLogo", winner ? winner.logo : "🏆");
  setText("profileName", winner ? winner.name : "Belum ada juara");
  setText(
    "profileSubtitle",
    champion ? "JUARA eFootball League Season 1" : "Liga sedang berjalan"
  );
  setText(
    "profileDescription",
    champion
      ? `${winner.name} menjadi juara berdasarkan klasemen final.`
      : "Tim dengan poin tertinggi akan menempati posisi teratas klasemen."
  );

  setText("finalLogo", champion ? winner.logo : "🏆");
  setText("finalWinner", champion ? winner.name : "Belum ada juara");
  setText(
    "finalSubtitle",
    champion ? "JUARA eFOOTBALL LEAGUE · SEASON 1" : "SEASON 1"
  );
  setText(
    "finalDescription",
    champion
      ? `Selamat kepada ${winner.name} atas pencapaian juara liga.`
      : "Liga belum diakhiri oleh admin."
  );

  setText("statPoints", winner ? winner.points : 0);
  setText("statWins", winner ? winner.wins : 0);
  setText("statDraws", winner ? winner.draws : 0);
  setText("statLosses", winner ? winner.losses : 0);
  setText("statGF", winner ? winner.gf : 0);
  setText("statGA", winner ? winner.ga : 0);
  setText(
    "statGD",
    winner ? `${winner.gd > 0 ? "+" : ""}${winner.gd}` : 0
  );

  setText("tableStatus", league.finished ? "LIGA BERAKHIR" : "SEDANG BERJALAN");

  const endButton = document.getElementById("endLeagueButton");
  const adminEndButton = document.getElementById("adminEndLeague");

  if (endButton) {
    endButton.textContent = league.finished
      ? "✓ Liga Telah Berakhir"
      : "🏆 Akhiri Liga →";
  }

  if (adminEndButton) {
    adminEndButton.textContent = league.finished
      ? "✓ Liga Telah Berakhir"
      : "🏆 Akhiri Liga";
  }
}

function fixtureHTML(match) {
  const home = teamById(match.homeId);
  const away = teamById(match.awayId);

  if (!home || !away) return "";

  return `
    <div class="fixture">
      <div class="fixture-team">
        ${escapeHTML(home.logo)} ${escapeHTML(home.name)}
      </div>
      <div>
        <div class="fixture-score">
          ${match.played
            ? `${match.homeScore} - ${match.awayScore}`
            : "VS"}
        </div>
        <div class="fixture-status">
          ${match.played ? "FULL TIME" : `MATCHDAY ${match.matchday}`}
        </div>
      </div>
      <div class="fixture-team">
        ${escapeHTML(away.logo)} ${escapeHTML(away.name)}
      </div>
    </div>
  `;
}

function renderFixtures() {
  const upcoming = league.fixtures.filter(match => !match.played);
  const results = league.fixtures.filter(match => match.played).reverse();

  const setHTML = (id, html) => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = html;
  };

  setHTML(
    "fixtureList",
    upcoming.length
      ? upcoming.map(fixtureHTML).join("")
      : `<div class="empty">Tidak ada jadwal tersisa.</div>`
  );

  setHTML(
    "resultList",
    results.length
      ? results.map(fixtureHTML).join("")
      : `<div class="empty">Belum ada hasil pertandingan.</div>`
  );

  setHTML(
    "recentMatches",
    results.length
      ? results.slice(0, 3).map(fixtureHTML).join("")
      : `<div class="empty">Hasil pertandingan akan tampil di sini.</div>`
  );

  const select = document.getElementById("fixtureSelect");

  if (select) {
    select.innerHTML = `
      <option value="">Pilih pertandingan</option>
      ${upcoming.map(match => {
        const home = teamById(match.homeId);
        const away = teamById(match.awayId);

        if (!home || !away) return "";

        return `
          <option value="${match.id}">
            MD ${match.matchday} · ${escapeHTML(home.name)} vs ${escapeHTML(away.name)}
          </option>
        `;
      }).join("")}
    `;
  }
}

function renderClubs() {
  const target = document.getElementById("clubList");
  if (!target) return;

  const standings = getStandings();

  target.innerHTML = league.teams.length
    ? league.teams.map(team => {
        const stats = standings.find(item => item.id === team.id);

        return `
          <div class="club-card">
            <span class="club-emoji">${escapeHTML(team.logo)}</span>
            <h3>${escapeHTML(team.name)}</h3>
            <p>${stats ? stats.points : 0} Poin</p>
          </div>
        `;
      }).join("")
    : `<div class="empty">Belum ada klub yang terdaftar.</div>`;
}

function renderAll() {
  renderTable("leagueTable", 10);
  renderTable("fullLeagueTable");
  renderTable("finalLeagueTable");
  renderPodium();
  renderChampion();
  renderFixtures();
  renderClubs();
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active-page", page.id === pageId);
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  const hero = document.getElementById("hero");

  if (hero) {
    hero.classList.toggle("hidden", pageId !== "home");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.go);
  });
});

document.getElementById("adminNav")?.addEventListener("click", () => {
  showPage("admin");
});

document.getElementById("viewFinalTable")?.addEventListener("click", () => {
  showPage("juara");
});

document.getElementById("addClubForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const message = document.getElementById("clubMessage");

  if (league.finished) {
    message.textContent = "Liga sudah berakhir. Reset liga untuk mengubah data.";
    return;
  }

  const nameInput = document.getElementById("clubNameInput");
  const logoInput = document.getElementById("clubLogoInput");
  const name = nameInput.value.trim();

  if (!name) return;

  if (league.teams.some(team =>
    team.name.toLowerCase() === name.toLowerCase()
  )) {
    message.textContent = "Nama klub sudah terdaftar.";
    return;
  }

  if (league.fixtures.length) {
    message.textContent = "Reset jadwal terlebih dahulu sebelum menambah klub.";
    return;
  }

  league.teams.push({
    id: crypto.randomUUID(),
    name,
    logo: logoInput.value.trim() || "⚽"
  });

  saveData();
  renderAll();

  nameInput.value = "";
  logoInput.value = "";
  message.textContent = "Klub berhasil ditambahkan.";
});

document.getElementById("generateSchedule")?.addEventListener("click", () => {
  const message = document.getElementById("scheduleMessage");

  if (league.finished) {
    message.textContent = "Liga sudah berakhir.";
    return;
  }

  if (league.teams.length < 2) {
    message.textContent = "Tambahkan minimal dua klub terlebih dahulu.";
    return;
  }

  if (league.fixtures.length) {
    message.textContent = "Jadwal sudah dibuat. Reset liga untuk membuat ulang.";
    return;
  }

  const teams = [...league.teams];

  if (teams.length % 2 !== 0) {
    teams.push(null);
  }

  const totalTeams = teams.length;
  const rounds = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;
  const fixtures = [];
  let rotation = [...teams];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const home = rotation[i];
      const away = rotation[totalTeams - 1 - i];

      if (!home || !away) continue;

      fixtures.push({
        id: crypto.randomUUID(),
        homeId: home.id,
        awayId: away.id,
        matchday: round + 1,
        played: false,
        homeScore: null,
        awayScore: null
      });
    }

    const fixed = rotation[0];
    const rest = rotation.slice(1);

    rest.unshift(rest.pop());
    rotation = [fixed, ...rest];
  }

  league.fixtures = fixtures;

  saveData();
  renderAll();

  message.textContent = `${fixtures.length} pertandingan berhasil dibuat.`;
});

document.getElementById("resultForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const message = document.getElementById("resultMessage");

  if (league.finished) {
    message.textContent = "Liga sudah berakhir.";
    return;
  }

  const match = league.fixtures.find(item =>
    item.id === document.getElementById("fixtureSelect").value
  );

  const homeScore = Number(document.getElementById("homeScore").value);
  const awayScore = Number(document.getElementById("awayScore").value);

  if (!match) {
    message.textContent = "Pilih pertandingan terlebih dahulu.";
    return;
  }

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    message.textContent = "Skor harus bilangan bulat nol atau lebih.";
    return;
  }

  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.played = true;

  saveData();
  renderAll();

  document.getElementById("homeScore").value = "";
  document.getElementById("awayScore").value = "";

  message.textContent = "Hasil pertandingan berhasil disimpan.";
});

function endLeague() {
  const message = document.getElementById("endLeagueMessage");

  if (league.finished) {
    message.textContent = "Liga sudah berakhir.";
    return;
  }

  if (!league.teams.length) {
    message.textContent = "Belum ada klub di liga.";
    return;
  }

  const remaining = league.fixtures.filter(match => !match.played);

  if (!league.fixtures.length || remaining.length) {
    message.textContent =
      "Selesaikan semua pertandingan sebelum mengakhiri liga.";

    const adminMessage = document.getElementById("adminMessage");
    if (adminMessage) adminMessage.textContent = message.textContent;

    return;
  }

  if (!confirm(
    "Akhiri liga sekarang? Klasemen akan ditetapkan sebagai klasemen final."
  )) {
    return;
  }

  league.finished = true;

  saveData();
  renderAll();

  message.textContent = "Liga berakhir. Klasemen final telah ditetapkan.";

  const adminMessage = document.getElementById("adminMessage");
  if (adminMessage) adminMessage.textContent = message.textContent;
}

document.getElementById("endLeagueButton")?.addEventListener("click", endLeague);
document.getElementById("adminEndLeague")?.addEventListener("click", endLeague);

document.getElementById("resetLeague")?.addEventListener("click", () => {
  if (!confirm(
    "Semua klub, jadwal, dan hasil akan dihapus dari browser ini. Lanjutkan?"
  )) {
    return;
  }

  league = {
    teams: [],
    fixtures: [],
    finished: false
  };

  saveData();
  renderAll();

  const message = document.getElementById("adminMessage");
  if (message) message.textContent = "Data liga berhasil direset.";
});

renderAll();
