// Scelta delle 5 categorie: manuale (ricerca, filtro per gruppo, riordino) oppure 🎲 Casuale con 🔄 per slot.
import { h, qsa } from '../dom.js';
import { T } from '../strings.js';
import { SLOTS, eligibleCategories, fillSlots, matchesSearch, rerollSlot } from '../content.js';
import { createRng } from '../random.js';
import { toast } from '../components/toast.js';

const rng = createRng();

export function renderCategories(ctx) {
  const game = ctx.store.game;
  const draft = game.draft;
  const all = ctx.index?.categories ?? [];
  const byId = new Map(all.map((c) => [c.id, c]));
  const onlyVerified = game.options.onlyVerified;
  const pool = eligibleCategories(all, { groups: draft.groups, onlyVerified });
  const recent = ctx.store.history.categories ?? [];
  const chosen = draft.slots.filter(Boolean).length;
  const setDraft = (patch) => ctx.actions.updateGame((g) => ({ ...g, draft: { ...g.draft, ...patch } }));

  const toggle = (id) => {
    const at = draft.slots.indexOf(id);
    if (at >= 0) {
      const slots = [...draft.slots];
      slots[at] = null;
      setDraft({ slots });
      return;
    }
    const free = draft.slots.indexOf(null);
    if (free < 0) {
      toast(T.categories.full);
      return;
    }
    const slots = [...draft.slots];
    slots[free] = id;
    setDraft({ slots });
  };

  const move = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= SLOTS) return;
    const slots = [...draft.slots];
    [slots[i], slots[j]] = [slots[j], slots[i]];
    setDraft({ slots });
  };

  const slotsRow = h('ol', { class: 'slots' }, draft.slots.map((id, i) => {
    const cat = id ? byId.get(id) : null;
    return h('li', { class: ['slot', !cat && 'slot--empty'] },
      h('span', { class: 'slot__num' }, i + 1),
      cat
        ? h('span', { class: 'slot__name' }, h('span', { class: 'slot__emoji', 'aria-hidden': 'true' }, cat.emoji), cat.name)
        : h('span', { class: 'slot__name slot__name--empty' }, T.categories.empty),
      cat && h('span', { class: 'slot__tools' },
        h('button', { class: 'btn btn--icon btn--small', type: 'button', 'aria-label': T.categories.moveLeft(cat.name), 'data-fk': `left-${i}`, disabled: i === 0, on: { click: () => move(i, -1) } }, '◀'),
        h('button', { class: 'btn btn--icon btn--small', type: 'button', 'aria-label': T.categories.moveRight(cat.name), 'data-fk': `right-${i}`, disabled: i === SLOTS - 1, on: { click: () => move(i, 1) } }, '▶'),
        h('button', {
          class: 'btn btn--icon btn--small',
          type: 'button',
          'aria-label': T.categories.reroll(cat.name),
          title: T.categories.reroll(cat.name),
          'data-fk': `reroll-${i}`,
          on: {
            click: () => {
              const slots = rerollSlot(draft.slots, i, pool, { rng, recent });
              if (slots) setDraft({ slots });
              else toast(T.categories.noMore);
            },
          },
        }, '🔄'),
        h('button', { class: 'btn btn--icon btn--small', type: 'button', 'aria-label': T.categories.remove(cat.name), 'data-fk': `rm-${i}`, on: { click: () => toggle(id) } }, '✕')));
  }));

  const groupChips = h('div', { class: 'chips', role: 'group', 'aria-label': T.categories.groups },
    (ctx.index?.groups ?? []).map((g) => {
      const on = draft.groups.includes(g.id);
      return h('button', {
        class: ['chip', on && 'chip--on'],
        type: 'button',
        'aria-pressed': String(on),
        'data-fk': `group-${g.id}`,
        on: {
          click: () => {
            const groups = on ? draft.groups.filter((x) => x !== g.id) : [...draft.groups, g.id];
            if (groups.length > 0) setDraft({ groups });
          },
        },
      }, g.name);
    }));

  const noResults = h('p', { class: 'notice', hidden: true }, T.categories.noResults);
  const applySearch = (query) => {
    let visible = 0;
    for (const card of qsa('.card', grid)) {
      const show = matchesSearch(byId.get(card.dataset.id), query);
      card.hidden = !show;
      if (show) visible++;
    }
    noResults.hidden = visible > 0;
  };

  const search = h('input', {
    class: 'input search',
    type: 'search',
    placeholder: T.categories.search,
    'aria-label': T.categories.search,
    value: ctx.ui.query,
    'data-fk': 'search',
    on: {
      input: (e) => {
        ctx.ui.query = e.target.value;
        applySearch(ctx.ui.query);
      },
    },
  });

  const grid = h('div', { class: 'card-grid' }, all.filter((c) => draft.groups.includes(c.group)).map((c) => {
    const slot = draft.slots.indexOf(c.id);
    const blocked = onlyVerified && !c.playableVerified;
    return h('button', {
      class: ['card', slot >= 0 && 'card--selected'],
      type: 'button',
      dataset: { id: c.id },
      'data-fk': `cat-${c.id}`,
      'aria-pressed': String(slot >= 0),
      disabled: blocked && slot < 0,
      on: { click: () => toggle(c.id) },
    },
    h('span', { class: 'card__emoji', 'aria-hidden': 'true' }, c.emoji),
    h('span', { class: 'card__name' }, c.name),
    h('span', { class: 'card__desc' }, c.description),
    h('span', { class: 'card__meta' },
      h('span', { class: 'card__group' }, ctx.index.groups.find((g) => g.id === c.group)?.name ?? c.group),
      c.unverified > 0 && h('span', { class: 'card__warn' }, T.categories.unverified(c.unverified)),
      blocked && h('span', { class: 'card__warn' }, T.categories.notPlayable)),
    slot >= 0 && h('span', { class: 'card__badge' }, slot + 1));
  }));
  applySearch(ctx.ui.query);

  return h('section', { class: 'screen categories' },
    h('header', { class: 'screen__header' },
      h('h1', { class: 'screen__title' }, T.categories.title),
      h('span', { class: 'screen__counter' }, T.categories.count(chosen))),
    slotsRow,
    h('div', { class: 'toolbar' },
      search,
      groupChips,
      h('button', {
        class: 'btn',
        type: 'button',
        title: T.categories.randomHint,
        'data-fk': 'random',
        on: {
          click: () => {
            const slots = fillSlots(draft.slots, pool, { rng, recent });
            if (slots.filter(Boolean).length === chosen && chosen < SLOTS) toast(T.categories.noMore);
            setDraft({ slots });
          },
        },
      }, T.categories.random),
      h('button', {
        class: 'btn btn--ghost',
        type: 'button',
        'data-fk': 'clear',
        disabled: chosen === 0,
        on: { click: () => setDraft({ slots: Array(SLOTS).fill(null) }) },
      }, T.categories.clear)),
    h('div', { class: 'scroll' }, grid, noResults),
    h('footer', { class: 'screen__footer' },
      h('button', { class: 'btn btn--ghost', type: 'button', 'data-fk': 'back', on: { click: ctx.actions.toSetup } }, T.back),
      h('button', {
        class: 'btn btn--primary',
        type: 'button',
        'data-fk': 'start',
        disabled: chosen !== SLOTS,
        on: { click: ctx.actions.startBoard },
      }, T.categories.start)));
}
