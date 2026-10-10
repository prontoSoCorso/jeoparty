// Setup: squadre (2–6) e opzioni della partita. Le ultime scelte vengono ricordate.
import { h } from '../dom.js';
import { T } from '../strings.js';
import { MAX_TEAMS, MIN_TEAMS, NAME_MAX, TIMER_MAX, TIMER_MIN, addTeam, cleanName, removeTeam } from '../rules.js';
import { textSizeButtons } from '../components/text-size.js';

// Daily Double (puntata, milestone M4) e Gran Finale (M5): fino ad allora restano nascosti e disattivati.
export const DAILY_DOUBLE_READY = false;
export const FINAL_READY = false;

function checkbox({ label, hint, checked, fk, onChange }) {
  return h('label', { class: 'switch' },
    h('input', { type: 'checkbox', checked, 'data-fk': fk, on: { change: (e) => onChange(e.target.checked) } }),
    h('span', { class: 'switch__text' }, h('strong', null, label), hint && h('small', null, hint)));
}

function radioGroup({ name, legend, options, value, onChange, className = 'segmented' }) {
  return h('fieldset', { class: className },
    h('legend', null, legend),
    options.map((o) => h('label', { class: 'segmented__item' },
      h('input', {
        type: 'radio',
        name,
        value: String(o.value),
        checked: o.value === value,
        'data-fk': `${name}-${o.value}`,
        on: { change: () => onChange(o.value) },
      }),
      h('span', null, h('strong', null, o.label), o.hint && h('small', null, o.hint)))));
}

export function renderSetup(ctx) {
  const game = ctx.store.game;
  const o = game.options;
  const update = (fn, render = true) => ctx.actions.updateGame((g) => {
    const next = structuredClone(g);
    fn(next);
    return next;
  }, { render });

  const teams = h('section', { class: 'panel setup__teams' },
    h('h2', { class: 'panel__title' }, T.setup.teams),
    h('ol', { class: 'team-list' }, game.teams.map((t, i) =>
      h('li', { class: 'team-row', style: { '--team': t.color } },
        h('span', { class: 'team-row__swatch', 'aria-hidden': 'true' }),
        h('input', {
          class: 'input',
          type: 'text',
          value: t.name,
          maxlength: NAME_MAX,
          'aria-label': T.setup.teamName(i + 1),
          'data-fk': `name-${t.id}`,
          on: {
            input: (e) => update((g) => { g.teams[i].name = e.target.value; }, false),
            change: (e) => update((g) => { g.teams[i].name = cleanName(e.target.value, i); }),
          },
        }),
        game.teams.length > MIN_TEAMS && h('button', {
          class: 'btn btn--icon btn--ghost',
          type: 'button',
          'aria-label': T.setup.removeTeam(t.name),
          'data-fk': `rm-${t.id}`,
          on: {
            click: () => update((g) => {
              g.teams = removeTeam(g.teams, t.id);
              if (g.firstTeam === t.id) g.firstTeam = 'random';
            }),
          },
        }, '✕')))),
    game.teams.length < MAX_TEAMS && h('button', {
      class: 'btn btn--ghost',
      type: 'button',
      'data-fk': 'add-team',
      on: { click: () => update((g) => { g.teams = addTeam(g.teams); }) },
    }, T.setup.addTeam),
    h('label', { class: 'field' },
      h('span', { class: 'field__label' }, T.setup.firstTeam),
      h('select', {
        class: 'input',
        'data-fk': 'first-team',
        on: { change: (e) => update((g) => { g.firstTeam = e.target.value; }) },
      },
      h('option', { value: 'random', selected: game.firstTeam === 'random' || !game.firstTeam }, T.setup.random),
      game.teams.map((t) => h('option', { value: t.id, selected: game.firstTeam === t.id }, t.name)))));

  const options = h('section', { class: 'panel setup__options' },
    radioGroup({
      name: 'mode',
      legend: T.setup.mode,
      className: 'segmented segmented--cards',
      value: o.mode,
      options: [
        { value: 'turn', label: T.setup.modeTurn, hint: T.setup.modeTurnHint },
        { value: 'race', label: T.setup.modeRace, hint: T.setup.modeRaceHint },
      ],
      onChange: (mode) => update((g) => { g.options.mode = mode; }),
    }),
    o.mode === 'turn' && checkbox({
      label: T.setup.steal,
      hint: T.setup.stealHint,
      checked: o.steal,
      fk: 'steal',
      onChange: (v) => update((g) => { g.options.steal = v; }),
    }),
    checkbox({
      label: T.setup.penalty,
      hint: T.setup.penaltyHint,
      checked: o.penalty,
      fk: 'penalty',
      onChange: (v) => update((g) => { g.options.penalty = v; }),
    }),
    h('div', { class: 'setup__inline' },
      checkbox({
        label: T.setup.timer,
        checked: o.timer.enabled,
        fk: 'timer',
        onChange: (v) => update((g) => { g.options.timer.enabled = v; }),
      }),
      h('label', { class: 'field field--inline' },
        h('input', {
          class: 'input input--number',
          type: 'number',
          min: TIMER_MIN,
          max: TIMER_MAX,
          step: 5,
          value: o.timer.seconds,
          disabled: !o.timer.enabled,
          'data-fk': 'timer-seconds',
          on: {
            change: (e) => update((g) => {
              const n = Math.round(Number(e.target.value));
              g.options.timer.seconds = Math.min(TIMER_MAX, Math.max(TIMER_MIN, Number.isFinite(n) ? n : 30));
            }),
          },
        }),
        h('span', null, T.setup.timerSeconds))),
    DAILY_DOUBLE_READY && radioGroup({
      name: 'dd',
      legend: T.setup.dailyDoubles,
      value: o.dailyDoubles,
      options: [0, 1, 2].map((n) => ({ value: n, label: String(n) })),
      onChange: (n) => update((g) => { g.options.dailyDoubles = n; }),
    }),
    FINAL_READY && checkbox({
      label: T.setup.final,
      hint: T.setup.finalHint,
      checked: o.final,
      fk: 'final',
      onChange: (v) => update((g) => { g.options.final = v; }),
    }),
    checkbox({
      label: T.setup.onlyVerified,
      checked: o.onlyVerified,
      fk: 'only-verified',
      onChange: (v) => update((g) => { g.options.onlyVerified = v; }),
    }),
    h('div', { class: 'field' },
      h('span', { class: 'field__label' }, T.setup.textSize),
      textSizeButtons(ctx)));

  return h('section', { class: 'screen setup' },
    h('header', { class: 'screen__header' }, h('h1', { class: 'screen__title' }, T.setup.title)),
    h('div', { class: 'setup__body' }, teams, options),
    h('footer', { class: 'screen__footer' },
      h('button', { class: 'btn btn--ghost', type: 'button', 'data-fk': 'back', on: { click: ctx.actions.goHome } }, T.back),
      h('button', {
        class: 'btn btn--primary',
        type: 'button',
        'data-fk': 'next',
        on: { click: ctx.actions.toCategories },
      }, T.setup.next)));
}
