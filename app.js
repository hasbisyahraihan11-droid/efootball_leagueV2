
/* ==========================================
   EFLEAGUE — SUPABASE APPLICATION
   ========================================== */

// 1. KONFIGURASI SUPABASE
const SUPABASE_URL = "https://krhtqhjyzfaeqeytuzyp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YBzD07cNtBLPuBrV2mJCTA_zg8zF_h9";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// 2. STATE APLIKASI
let teams = [];
let fixtures = [];
let matches = [];
let seasons = [];
let activeSeason = null;
let seasonParticipants = [];
let currentUser = null;
let isAdmin = false;
let loading = false;

// 3. HELPER
const $ = (selector) => document.querySelector(selector);

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showNotice(message, isError = false) {
    const notice = $("#notice");
    notice.textContent = message;
    notice.classList.toggle("error", isError);
    notice.hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function setMessage(selector, message, isError = false) {
    const element = $(selector);
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", isError);
}

function formatDate(value) {
    if (!value) return "Jadwal belum ditentukan";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Jadwal belum ditentukan";
    }

    return date.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function teamInitial(name = "?") {
    return escapeHTML(
        name.trim().split(/\s+/).slice(0, 2)
            .map((word) => word[0] || "")
            .join("")
            .toUpperCase()
    );
}

function teamMark(team) {
    const name = escapeHTML(team?.name || "Tim");
    const logo = team?.logo_url;

    // Hanya gunakan URL gambar HTTP(S).
    let safeLogo = "";

    if (logo) {
        try {
            const url = new URL(logo);
            if (url.protocol === "https:" || url.protocol === "http:") {
                safeLogo = url.href;
            }
        } catch (_) {}
    }

    if (safeLogo) {
        return `<div class="team-mark">
            <img src="${escapeHTML(safeLogo)}"
                 alt="Logo ${name}"
                 loading="lazy"
                 onerror="this.parentElement.textContent='${teamInitial(team?.name)}'">
        </div>`;
    }

    return `<div class="team-mark">${teamInitial(team?.name)}</div>`;
}

function fixtureTeams(fixture) {
    return {
        home: fixture.home_team || {
            id: fixture.home_team_id,
            name: "Tim kandang"
        },
        away: fixture.away_team || {
            id: fixture.away_team_id,
            name: "Tim tandang"
        }
    };
}

// 4. NAVIGASI
function showPage(page) {
    document.querySelectorAll(".page").forEach((element) => {
        element.classList.toggle("active", element.id === `page-${page}`);
    });

    document.querySelectorAll(".nav-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.page === page);
    });

    const titles = {
        home: "Dashboard",
        ranking: "Ranking",
        teams: "Daftar Tim",
        fixtures: "Jadwal Pertandingan",
        champions: "Hall of Fame",
        admin: "Admin Panel"
    };

    $("#page-title").textContent = titles[page] || "Dashboard";

    if (page === "admin") {
        refreshAdminView();
    }
    if (page === "champions") {
        renderChampions();
    }
}

// 5. MEMUAT DATA SUPABASE
async function loadTeams() {
    const { data, error } = await supabaseClient
        .from("teams")
        .select("id, name, logo_url, created_at")
        .order("name");

    if (error) throw error;

    teams = data || [];
}

async function loadSeasons() {
    const { data, error } = await supabaseClient
        .from("seasons")
        .select("id, name, status, champion_team_id, runner_up_team_id, third_place_team_id, champion_points, champion_wins, champion_goal_difference, completed_at, created_at")
        .order("created_at", { ascending: false });

    if (error) throw error;
    seasons = data || [];
    activeSeason = seasons.find((season) => season.status === "ACTIVE") || null;

    if (activeSeason) {
        const { data: participants, error: participantError } = await supabaseClient
            .from("season_teams")
            .select("team_id")
            .eq("season_id", activeSeason.id);
        if (participantError) throw participantError;
        seasonParticipants = (participants || []).map((item) => Number(item.team_id));
    } else {
        seasonParticipants = [];
    }
}

async function loadFixtures() {
    const { data, error } = await supabaseClient
        .from("fixtures")
        .select(`
            id,
            season_id,
            matchday,
            home_team_id,
            away_team_id,
            scheduled_at,
            status,
            home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
            away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url)
        `)
        .order("matchday")
        .order("id");

    if (error) throw error;
    const allFixtures = data || [];
    // Saat ada musim aktif, tampilkan hanya jadwal musim itu. Sebelum musim pertama,
    // data jadwal lama (season_id NULL) tetap ditampilkan agar tidak hilang.
    fixtures = activeSeason
        ? allFixtures.filter((item) => Number(item.season_id) === Number(activeSeason.id))
        : allFixtures.filter((item) => item.season_id == null);
}

async function loadMatches() {
    const { data, error } = await supabaseClient
        .from("matches")
        .select(`
            id,
            fixture_id,
            home_score,
            away_score,
            played_at,
            fixture:fixtures(
                id,
                season_id,
                matchday,
                home_team_id,
                away_team_id,
                home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
                away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url)
            )
        `)
        .order("played_at", { ascending: false });

    if (error) throw error;
    const allowedFixtureIds = new Set(fixtures.map((item) => Number(item.id)));
    matches = (data || []).filter((item) => allowedFixtureIds.has(Number(item.fixture_id)));
}

async function reloadLeague() {
    await loadTeams();
    await loadSeasons();
    await loadFixtures();
    await loadMatches();
    renderAll();
}

async function initializeApp() {
    try {
        await reloadLeague();

        const { data } = await supabaseClient.auth.getSession();
        currentUser = data.session?.user || null;

        if (currentUser) {
            await verifyAdmin();
        }

        refreshAdminView();
    } catch (error) {
        console.error("Inisialisasi gagal:", error);
        showNotice(
            "Gagal memuat data Supabase. Periksa konfigurasi dan pesan error di Console.",
            true
        );
    }
}

// 6. LOGIN DAN VERIFIKASI ADMIN
async function verifyAdmin() {
    isAdmin = false;

    if (!currentUser) return false;

    const { data, error } = await supabaseClient.rpc(
        "is_current_user_admin"
    );

    if (error) {
        console.error("Pemeriksaan admin gagal:", error);
        return false;
    }

    isAdmin = data === true;
    return isAdmin;
}

$("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("#admin-email").value.trim();
    const password = $("#admin-password").value;
    const button = event.submitter;

    button.disabled = true;
    setMessage("#login-message", "Memeriksa akun...");

    try {
        const { data, error } = await supabaseClient.auth
            .signInWithPassword({ email, password });

        if (error) throw error;

        currentUser = data.user;

        const authorized = await verifyAdmin();

        if (!authorized) {
            await supabaseClient.auth.signOut();
            currentUser = null;
            throw new Error(
                "Akun berhasil login, tetapi belum terdaftar sebagai admin."
            );
        }

        $("#login-form").reset();
        setMessage("#login-message", "Login admin berhasil!");

        refreshAdminView();
        showNotice("Selamat datang di panel admin.");
    } catch (error) {
        console.error(error);
        setMessage(
            "#login-message",
            error.message || "Login gagal.",
            true
        );
    } finally {
        button.disabled = false;
    }
});

async function logoutAdmin() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        showNotice("Logout gagal: " + error.message, true);
        return;
    }

    currentUser = null;
    isAdmin = false;
    refreshAdminView();
    showNotice("Lu sudah logout dari panel admin.");
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;

    if (!currentUser) {
        isAdmin = false;
        refreshAdminView();
    } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        // Verifikasi dilakukan setelah callback auth selesai.
        setTimeout(async () => {
            await verifyAdmin();
            refreshAdminView();
        }, 0);
    }
});

function refreshAdminView() {
    const login = $("#admin-login");
    const dashboard = $("#admin-dashboard");

    if (!login || !dashboard) return;

    login.hidden = isAdmin;
    dashboard.hidden = !isAdmin;

    if (isAdmin && currentUser) {
        $("#admin-identity").textContent =
            "Login sebagai " + currentUser.email;
        renderSeasonControls();
    }
}

// 7. KELOLA MUSIM DAN PESERTA
function renderSeasonTeamOptions() {
    const select = $("#season-teams");
    if (!select) return;
    const selected = new Set(Array.from(select.selectedOptions || []).map((option) => option.value));
    select.innerHTML = "";
    teams.forEach((team) => {
        const option = document.createElement("option");
        option.value = String(team.id);
        option.textContent = team.name;
        option.selected = selected.has(option.value);
        select.appendChild(option);
    });
}

function renderSeasonControls() {
    renderSeasonTeamOptions();
    const info = $("#admin-season-info");
    const finalizeButton = $("#finalize-season-btn");
    if (!info) return;

    if (!activeSeason) {
        info.innerHTML = '<div class="empty-state">Belum ada musim aktif. Buat musim baru untuk memulai liga.</div>';
        if (finalizeButton) finalizeButton.disabled = true;
        return;
    }

    const seasonFixtures = fixtures;
    const allPlayed = seasonFixtures.length > 0 && seasonFixtures.every((item) => item.status === "PLAYED");
    const participants = teams.filter((team) => seasonParticipants.includes(Number(team.id)));
    info.innerHTML = `
        <strong>${escapeHTML(activeSeason.name)}</strong>
        <p>Status: <strong>AKTIF</strong></p>
        <p>Peserta: ${participants.length} tim</p>
        <p>Pertandingan: ${seasonFixtures.filter((item) => item.status === "PLAYED").length}/${seasonFixtures.length} selesai</p>
        ${seasonFixtures.length === 0 ? '<p class="muted">Buat jadwal musim ini terlebih dahulu.</p>' : ''}
    `;
    if (finalizeButton) finalizeButton.disabled = !allPlayed;
}

const seasonForm = $("#season-form");
if (seasonForm) {
    seasonForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!isAdmin) {
            setMessage("#season-message", "Login admin diperlukan.", true);
            return;
        }
        if (activeSeason) {
            setMessage("#season-message", "Selesaikan musim aktif sebelum membuat musim baru.", true);
            return;
        }

        const name = $("#season-name").value.trim();
        const teamIds = Array.from($("#season-teams").selectedOptions).map((option) => Number(option.value));
        if (!name) return;
        if (teamIds.length < 2) {
            setMessage("#season-message", "Pilih minimal 2 tim sebagai peserta.", true);
            return;
        }

        const submitButton = seasonForm.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        setMessage("#season-message", "Membuat musim...");
        let createdSeasonId = null;
        try {
            const { data: season, error: seasonError } = await supabaseClient
                .from("seasons")
                .insert({ name, status: "ACTIVE" })
                .select("id")
                .single();
            if (seasonError) throw seasonError;
            createdSeasonId = season.id;

            const participantRows = teamIds.map((teamId) => ({ season_id: createdSeasonId, team_id: teamId }));
            const { error: participantsError } = await supabaseClient.from("season_teams").insert(participantRows);
            if (participantsError) throw participantsError;

            seasonForm.reset();
            await reloadLeague();
            setMessage("#season-message", `Musim "${name}" berhasil dibuat. Sekarang buat jadwal musim ini.`);
        } catch (error) {
            console.error(error);
            if (createdSeasonId !== null) {
                await supabaseClient.from("seasons").delete().eq("id", createdSeasonId);
            }
            setMessage("#season-message", "Gagal membuat musim: " + error.message, true);
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

async function finalizeCurrentSeason() {
    if (!isAdmin || !activeSeason) {
        setMessage("#finalize-message", "Tidak ada musim aktif atau login admin diperlukan.", true);
        return;
    }
    const button = $("#finalize-season-btn");
    if (button) button.disabled = true;
    setMessage("#finalize-message", "Memeriksa hasil dan mengesahkan juara...");
    try {
        const { error } = await supabaseClient.rpc("finalize_season", { p_season_id: activeSeason.id });
        if (error) throw error;
        await reloadLeague();
        setMessage("#finalize-message", "Juara musim berhasil disahkan! Buka menu Juara untuk melihat podium.");
        renderChampions();
    } catch (error) {
        console.error(error);
        setMessage("#finalize-message", "Gagal mengesahkan juara: " + error.message, true);
    } finally {
        renderSeasonControls();
    }
}

// 8. TAMBAH TIM
$("#team-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isAdmin) {
        showNotice("Login admin diperlukan.", true);
        return;
    }

    const name = $("#team-name").value.trim();
    const logo = $("#team-logo").value.trim();

    if (!name) return;

    try {
        const { error } = await supabaseClient
            .from("teams")
            .insert({
                name,
                logo_url: logo || null
            });

        if (error) throw error;

        event.target.reset();
        await reloadLeague();
        showNotice(`Tim "${name}" berhasil ditambahkan.`);
    } catch (error) {
        console.error(error);
        showNotice(
            "Gagal menambahkan tim: " + error.message,
            true
        );
    }
});

// 8. JADWAL OTOMATIS ROUND-ROBIN
async function generateFixtures() {
    if (!isAdmin) {
        showNotice("Login admin diperlukan.", true);
        return;
    }

    const button = $("#generate-fixtures-btn");
    if (button) button.disabled = true;
    try {
        await loadTeams();
        await loadSeasons();
        if (!activeSeason) {
            throw new Error("Buat musim aktif di bagian Kelola Musim terlebih dahulu.");
        }

        const { data: participantRows, error: participantError } = await supabaseClient
            .from("season_teams").select("team_id").eq("season_id", activeSeason.id);
        if (participantError) throw participantError;
        const participantIds = (participantRows || []).map((item) => Number(item.team_id));
        const participantTeams = teams.filter((team) => participantIds.includes(Number(team.id)));
        if (participantTeams.length < 2) throw new Error("Musim ini harus memiliki minimal 2 tim peserta.");

        const { data: existingRows, error: existingError } = await supabaseClient
            .from("fixtures").select("id").eq("season_id", activeSeason.id).limit(1);
        if (existingError) throw existingError;
        if ((existingRows || []).length > 0) {
            setMessage("#schedule-message", "Jadwal musim ini sudah ada. Jadwal tidak dibuat ulang agar hasil lama aman.", true);
            return;
        }

        // Round-robin satu putaran, termasuk bye bila jumlah peserta ganjil.
        const rotation = [...participantTeams];
        if (rotation.length % 2 !== 0) rotation.push(null);
        const totalRounds = rotation.length - 1;
        const half = rotation.length / 2;
        const rows = [];

        for (let round = 0; round < totalRounds; round++) {
            for (let i = 0; i < half; i++) {
                const first = rotation[i];
                const second = rotation[rotation.length - 1 - i];
                if (!first || !second) continue;
                let home = first;
                let away = second;
                if ((round + i) % 2 === 1) { home = second; away = first; }
                rows.push({
                    season_id: activeSeason.id,
                    matchday: round + 1,
                    home_team_id: home.id,
                    away_team_id: away.id,
                    status: "UPCOMING"
                });
            }
            rotation.splice(1, 0, rotation.pop());
        }

        const { error } = await supabaseClient.from("fixtures").insert(rows);
        if (error) throw error;
        await reloadLeague();
        setMessage("#schedule-message", `${rows.length} pertandingan berhasil dibuat dalam ${totalRounds} matchday untuk ${activeSeason.name}.`);
    } catch (error) {
        console.error(error);
        setMessage("#schedule-message", "Gagal membuat jadwal: " + error.message, true);
    } finally {
        if (button) button.disabled = false;
    }
}

// 9. INPUT SKOR
$("#result-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isAdmin) {
        showNotice("Login admin diperlukan.", true);
        return;
    }

    const fixtureId = Number($("#result-fixture").value);
    const homeScore = Number($("#home-score").value);
    const awayScore = Number($("#away-score").value);

    if (
        !Number.isInteger(homeScore) ||
        !Number.isInteger(awayScore) ||
        homeScore < 0 ||
        awayScore < 0
    ) {
        setMessage("#result-message", "Skor harus bilangan bulat nonnegatif.", true);
        return;
    }

    const fixture = fixtures.find((item) => item.id === fixtureId);

    if (!fixture || fixture.status !== "UPCOMING") {
        setMessage("#result-message", "Pilih jadwal yang belum dimainkan.", true);
        return;
    }

    try {
        // Simpan hasil terlebih dahulu.
        const { error: matchError } = await supabaseClient
            .from("matches")
            .insert({
                fixture_id: fixtureId,
                home_score: homeScore,
                away_score: awayScore
            });

        if (matchError) throw matchError;

        // Tandai fixture sudah dimainkan.
        const { error: fixtureError } = await supabaseClient
            .from("fixtures")
            .update({ status: "PLAYED" })
            .eq("id", fixtureId);

        if (fixtureError) {
            throw new Error(
                "Hasil tersimpan, tetapi status jadwal gagal diperbarui. Muat ulang dan periksa database."
            );
        }

        event.target.reset();
        await reloadLeague();

        setMessage("#result-message", "Hasil pertandingan berhasil disimpan.");
    } catch (error) {
        console.error(error);
        setMessage(
            "#result-message",
            "Gagal menyimpan hasil: " + error.message,
            true
        );
    }
});

// 10. RENDER DASHBOARD
function renderAll() {
    renderStats();
    renderFeaturedFixture();
    renderLatestResults();
    renderTeams();
    renderFixtures();
    renderRanking();
    renderResultOptions();
    renderChampions();
    if (isAdmin) renderSeasonControls();
}

function renderStats() {
    const participatingTeams = activeSeason
        ? teams.filter((team) => seasonParticipants.includes(Number(team.id)))
        : teams;
    $("#stat-teams").textContent = participatingTeams.length;
    $("#stat-matches").textContent = matches.length;
    $("#stat-upcoming").textContent =
        fixtures.filter((item) => item.status === "UPCOMING").length;
}

function renderFeaturedFixture() {
    const container = $("#featured-fixture");

    const next = fixtures.find((item) => item.status === "UPCOMING");

    if (!next) {
        container.innerHTML = fixtures.length
            ? "Semua pertandingan sudah selesai."
            : "Belum ada jadwal. Admin dapat membuat jadwal melalui panel Admin.";
        return;
    }

    const { home, away } = fixtureTeams(next);

    container.innerHTML = `
        <div class="match-card">
            <div class="match-meta">
                MATCHDAY ${next.matchday} · ${escapeHTML(formatDate(next.scheduled_at))}
            </div>
            <div class="match-teams">
                <div class="match-team">
                    ${teamMark(home)}
                    <strong>${escapeHTML(home.name)}</strong>
                </div>
                <span class="vs">VS</span>
                <div class="match-team">
                    ${teamMark(away)}
                    <strong>${escapeHTML(away.name)}</strong>
                </div>
            </div>
        </div>`;
}

function renderLatestResults() {
    const container = $("#latest-results");

    if (!matches.length) {
        container.innerHTML = '<div class="empty-state">Belum ada hasil pertandingan.</div>';
        return;
    }

    container.innerHTML = matches.slice(0, 5).map((match) => {
        const fixture = match.fixture;
        const home = fixture?.home_team?.name || "Tim kandang";
        const away = fixture?.away_team?.name || "Tim tandang";

        return `
            <div class="result-row">
                <div>
                    <strong>${escapeHTML(home)} — ${escapeHTML(away)}</strong>
                    <small>Matchday ${fixture?.matchday ?? "-"}</small>
                </div>
                <strong class="result-score">
                    ${match.home_score} - ${match.away_score}
                </strong>
            </div>`;
    }).join("");
}

// 11. RENDER DAFTAR TIM
function renderTeams() {
    const container = $("#teams-grid");

    if (!teams.length) {
        container.innerHTML =
            '<div class="empty-state">Belum ada tim. Admin dapat menambahkan tim.</div>';
        return;
    }

    container.innerHTML = teams.map((team) => `
        <article class="team-card">
            ${teamMark(team)}
            <h3>${escapeHTML(team.name)}</h3>
            <p>REGISTERED CLUB</p>
        </article>
    `).join("");
}

// 12. RENDER JADWAL
function renderFixtures() {
    const container = $("#fixtures-list");

    if (!fixtures.length) {
        container.innerHTML =
            '<div class="empty-state">Belum ada jadwal pertandingan.</div>';
        return;
    }

    const grouped = new Map();

    fixtures.forEach((fixture) => {
        if (!grouped.has(fixture.matchday)) {
            grouped.set(fixture.matchday, []);
        }
        grouped.get(fixture.matchday).push(fixture);
    });

    container.innerHTML = [...grouped.entries()].map(([day, dayFixtures]) => `
        <article class="fixture-day">
            <h3>MATCHDAY ${day}</h3>
            ${dayFixtures.map((fixture) => {
                const { home, away } = fixtureTeams(fixture);
                const match = matches.find(
                    (item) => item.fixture_id === fixture.id
                );

                return `
                    <div class="fixture-item">
                        <div class="fixture-side">${escapeHTML(home.name)}</div>
                        <div class="fixture-center">
                            ${
                                match
                                ? `<strong>${match.home_score} - ${match.away_score}</strong>
                                   <small>FULL TIME</small>`
                                : `<strong>VS</strong>
                                   <small>${escapeHTML(formatDate(fixture.scheduled_at))}</small>`
                            }
                        </div>
                        <div class="fixture-side">${escapeHTML(away.name)}</div>
                    </div>`;
            }).join("")}
        </article>
    `).join("");
}

// 13. HITUNG KLASEMEN DAN FORM 5 LAGA
function calculateTable() {
    const table = new Map();

    const tableTeams = activeSeason
        ? teams.filter((team) => seasonParticipants.includes(Number(team.id)))
        : teams;
    tableTeams.forEach((team) => {
        table.set(team.id, {
            id: team.id,
            name: team.name,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            gf: 0,
            ga: 0,
            points: 0,
            form: []
        });
    });

    // matches sudah diurutkan paling baru.
    matches.forEach((match) => {
        const fixture = fixtures.find(
            (item) => item.id === match.fixture_id
        );

        if (!fixture) return;

        const home = table.get(fixture.home_team_id);
        const away = table.get(fixture.away_team_id);

        if (!home || !away) return;

        home.played++;
        away.played++;

        home.gf += match.home_score;
        home.ga += match.away_score;
        away.gf += match.away_score;
        away.ga += match.home_score;

        if (match.home_score > match.away_score) {
            home.wins++;
            away.losses++;
            home.points += 3;
            home.form.push("W");
            away.form.push("L");
        } else if (match.home_score < match.away_score) {
            away.wins++;
            home.losses++;
            away.points += 3;
            away.form.push("W");
            home.form.push("L");
        } else {
            home.draws++;
            away.draws++;
            home.points++;
            away.points++;
            home.form.push("D");
            away.form.push("D");
        }
    });

    return [...table.values()]
        .map((team) => ({
            ...team,
            gd: team.gf - team.ga,
            form: team.form.slice(0, 5)
        }))
        .sort((a, b) =>
            b.points - a.points ||
            b.gd - a.gd ||
            b.gf - a.gf ||
            a.name.localeCompare(b.name)
        );
}

function renderRanking() {
    const container = $("#ranking-body");
    const ranking = calculateTable();

    if (!ranking.length) {
        container.innerHTML =
            '<tr><td colspan="11" class="empty-state">Belum ada tim terdaftar.</td></tr>';
        return;
    }

    container.innerHTML = ranking.map((team, index) => `
        <tr>
            <td class="rank-number">${index + 1}</td>
            <td>${escapeHTML(team.name)}</td>
            <td>${team.played}</td>
            <td>${team.wins}</td>
            <td>${team.draws}</td>
            <td>${team.losses}</td>
            <td>${team.gf}</td>
            <td>${team.ga}</td>
            <td>${team.gd > 0 ? "+" : ""}${team.gd}</td>
            <td class="points-cell">${team.points}</td>
            <td>
                <div class="form-list">
                    ${
                        team.form.length
                        ? team.form.slice().reverse().map((result) => `
                            <span class="form-badge form-${result.toLowerCase()}">
                                ${result}
                            </span>
                        `).join("")
                        : '<span class="muted">-</span>'
                    }
                </div>
            </td>
        </tr>
    `).join("");
}

// 14. OPSI INPUT HASIL ADMIN
function renderResultOptions() {
    const select = $("#result-fixture");
    if (!select) return;

    const previousValue = select.value;

    const upcoming = fixtures.filter(
        (fixture) => fixture.status === "UPCOMING"
    );

    select.innerHTML = '<option value="">Pilih jadwal...</option>';

    upcoming.forEach((fixture) => {
        const { home, away } = fixtureTeams(fixture);
        const option = document.createElement("option");

        option.value = fixture.id;
        option.textContent =
            `MD ${fixture.matchday}: ${home.name} vs ${away.name}`;

        select.appendChild(option);
    });

    if (upcoming.some((fixture) => String(fixture.id) === previousValue)) {
        select.value = previousValue;
    }
}

// 15. HALL OF FAME / RIWAYAT JUARA
function renderChampions() {
    const latestContainer = $("#latest-champion");
    const podiumContainer = $("#champion-podium");
    const historyContainer = $("#champion-history");
    if (!latestContainer || !podiumContainer || !historyContainer) return;

    const completed = seasons.filter((season) => season.status === "COMPLETED");
    const getTeam = (id) => teams.find((team) => Number(team.id) === Number(id)) || null;

    if (!completed.length) {
        latestContainer.innerHTML = '<div class="empty-state">Belum ada juara yang disahkan. Selesaikan satu musim lalu sahkan juara dari panel Admin.</div>';
        podiumContainer.innerHTML = "";
        historyContainer.innerHTML = '<div class="empty-state">Riwayat juara akan muncul setelah musim selesai.</div>';
        return;
    }

    const latest = completed[0];
    const champion = getTeam(latest.champion_team_id);
    latestContainer.innerHTML = `
        <div class="champion-feature">
            <div class="muted">JUARA TERBARU</div>
            <h2>${escapeHTML(latest.name)}</h2>
            ${champion ? teamMark(champion) : ""}
            <h3>${escapeHTML(champion?.name || "Tim juara")}</h3>
            <p>${latest.champion_points ?? 0} poin · ${latest.champion_wins ?? 0} kemenangan · GD ${Number(latest.champion_goal_difference || 0) > 0 ? "+" : ""}${latest.champion_goal_difference ?? 0}</p>
        </div>`;

    const podium = [
        { place: "JUARA", id: latest.champion_team_id, medal: "🥇" },
        { place: "RUNNER-UP", id: latest.runner_up_team_id, medal: "🥈" },
        { place: "PERINGKAT 3", id: latest.third_place_team_id, medal: "🥉" }
    ].filter((item) => item.id != null);
    podiumContainer.innerHTML = podium.map((item) => {
        const team = getTeam(item.id);
        return `<article class="team-card champion-card"><div class="muted">${item.medal} ${item.place}</div>${team ? teamMark(team) : ""}<h3>${escapeHTML(team?.name || "Tim")}</h3><p>${escapeHTML(latest.name)}</p></article>`;
    }).join("");

    historyContainer.innerHTML = completed.map((season) => {
        const team = getTeam(season.champion_team_id);
        const date = season.completed_at ? new Date(season.completed_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "Tanggal tidak tersedia";
        return `<article class="fixture-day champion-history-item"><h3>${escapeHTML(season.name)}</h3><div class="result-row"><div>${team ? teamMark(team) : ""}<strong>${escapeHTML(team?.name || "Juara tidak tersedia")}</strong><small>${escapeHTML(date)}</small></div><strong class="points-cell">${season.champion_points ?? 0} poin</strong></div></article>`;
    }).join("");
}

// 16. MULAI APLIKASI
document.addEventListener("DOMContentLoaded", initializeApp);