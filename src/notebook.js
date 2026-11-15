// The notebook screen (main menu and pause menu) and the two menu entries of Phase 6:
//  - MR. HALE'S NOTES: the ones you found, in order, and a hint for each one you are missing
//  - UNLOCKS: what you earned, how to earn the rest, and the phone theme you use
//  - RECORDS: your best report card, the daily class, the endings you have seen, phone high scores
// Everything shown here is kept in the browser (src/profile.js).
import { HALE_NOTES, UNLOCKS, PHONE_THEMES, ENDINGS } from './data.js';
import { Profile } from './profile.js';
import { dayLabel, gradeOf } from './replay.js';

const $ = (id) => document.getElementById(id);
const TYPE = { prank: 'PRANK', app: 'PHONE APP', theme: 'THEME' };
// the endings worth collecting (the secret ones stay "???" until you have seen them)
const END_LIST = [['survived', 'Free Class'], ['true', 'Story'], ['escape', 'Story'], ['hale', 'Secret'], ['glasses', 'Secret']];
let tab = 'notes';

function notesHtml() {
  const have = Profile.noteCount();
  const cards = HALE_NOTES.map((N) => (Profile.hasNote(N.n)
    ? `<div class="nb-note" data-note="${N.n}"><h3>${N.n} / ${HALE_NOTES.length} · ${N.title.toUpperCase()}</h3>${N.text}</div>`
    : `<div class="nb-note missing" data-note="${N.n}"><h3>${N.n} / ${HALE_NOTES.length} · NOT FOUND YET</h3>${N.hint}</div>`)).join('');
  return `<p class="nb-intro">Mr. Hale hid <b>${HALE_NOTES.length} notes</b> in Room 13. You find one by doing something in class. Found: <b id="nb-count">${have} / ${HALE_NOTES.length}</b>.</p><div class="nb-notes">${cards}</div>`;
}

function unlocksHtml() {
  const theme = Profile.data.theme;
  const themeBtn = (id) => `<button data-theme="${id}" class="${theme === id ? 'on' : ''}">${theme === id ? 'IN USE' : 'USE'}</button>`;
  const rows = UNLOCKS.map((u) => {
    const got = Profile.has(u.id);
    return `<li class="${got ? '' : 'locked'}" data-unlock="${u.id}"><span class="tag">${TYPE[u.type] || u.type}</span><span class="what"><b>${got ? '✓' : '🔒'} ${u.name}</b><small>${got ? u.what : 'How: ' + u.how}</small></span>${got && u.type === 'theme' ? themeBtn(u.id) : ''}</li>`;
  }).join('');
  const classic = `<li data-unlock="classic"><span class="tag">THEME</span><span class="what"><b>✓ ${PHONE_THEMES.classic.name}</b><small>The phone you started with.</small></span>${themeBtn('classic')}</li>`;
  const n = UNLOCKS.filter((u) => Profile.has(u.id)).length;
  return `<p class="nb-intro">Earned with report cards and deeds. Unlocked: <b>${n} / ${UNLOCKS.length}</b>. New pranks join the prank selector (hold <kbd>G</kbd> / PRANK, then <kbd>X</kbd> / SWAP).</p><ul class="nb-list">${rows}${classic}</ul>`;
}

function recordsHtml(game) {
  const d = Profile.data, m = game.replayMenu();
  const days = Object.keys(d.daily).sort().reverse().slice(0, 6);
  const daily = days.length ? days.map((k) => `${dayLabel(k)}: <b>${d.daily[k].score}</b> (${d.daily[k].grade}${d.daily[k].hard ? ', Hard' : ''})`).join('<br>') : 'No daily class played yet.';
  const ends = END_LIST.map(([k, where]) => (d.endings[k] ? `✓ <b>${ENDINGS[k][0]}</b> <small>(${where})</small>` : `☐ ${where === 'Secret' ? '??? <small>(a secret ending)</small>' : '<small>' + where + ': not seen yet</small>'}`)).join('<br>');
  return `<div class="nb-rec">
    <div><h3>REPORT CARDS</h3>Best grade: <b>${d.best.score ? gradeOf(d.best.score) + ' (' + d.best.score + ' / 100)' : 'none yet'}</b><br>Classes finished: <b>${d.totals.classes || 0}</b><br>Times caught: <b>${d.totals.caught || 0}</b></div>
    <div><h3>DAILY CLASS</h3>Today: ${m.daily}<br>${daily}</div>
    <div><h3>ENDINGS</h3>${ends}</div>
    <div><h3>PHONE GAMES</h3>PAPER PLANE best: <b>${d.best.plane || 0}</b><br>PSST! best: <b>${Profile.has('psst') ? d.best.psst || 0 : 'locked'}</b></div>
  </div>${Profile.stored ? '' : '<p class="nb-warn">Your browser is not keeping this (private mode?). It lasts until you close the game.</p>'}`;
}

/** draw the open tab */
export function renderNotebook(game, which = tab) {
  tab = which;
  for (const b of document.querySelectorAll('#notebook-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  $('notebook-body').innerHTML = tab === 'unlocks' ? unlocksHtml() : tab === 'records' ? recordsHtml(game) : notesHtml();
  $('notebook-panel').scrollTop = 0;
}

/** the two entries in the title menu: today's daily class with your best, the notebook's numbers */
export function refreshMenu(game) {
  const m = game.replayMenu();
  $('daily-info').textContent = m.daily;
  $('notebook-info').textContent = m.notebook;
}

/** wire it up once (main.js) */
export function initNotebook(game) {
  for (const b of document.querySelectorAll('#notebook-tabs button')) b.onclick = () => renderNotebook(game, b.dataset.tab);
  // pick a phone theme
  $('notebook-body').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-theme]');
    if (!b) return;
    const id = b.dataset.theme;
    if (id !== 'classic' && !Profile.has(id)) return;
    Profile.setTheme(id);
    game.applyProfile();
    game.audio.play('page', { local: true, vol: 0.5 });
    renderNotebook(game, 'unlocks');
  });
  Profile.onChange = () => refreshMenu(game);
  refreshMenu(game);
  setInterval(() => refreshMenu(game), 60000); // a new day starts at midnight UTC
}
