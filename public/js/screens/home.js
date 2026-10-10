// Home: nuova partita, ripresa, regole e impostazioni.
import { h } from '../dom.js';
import { T } from '../strings.js';
import { VALUES } from '../rules.js';

export function renderHome(ctx) {
  const game = ctx.store.game;
  const canResume = Boolean(game);
  return h('section', { class: 'screen home' },
    h('div', { class: 'home__hero' },
      h('h1', { class: 'home__title' }, T.appName),
      h('p', { class: 'home__tagline' }, T.tagline),
      h('div', { class: 'home__tiles', 'aria-hidden': 'true' }, VALUES.map((v) => h('span', { class: 'home__tile' }, v)))),
    ctx.indexError && h('p', { class: 'notice notice--error' }, T.loadError),
    h('div', { class: 'home__actions' },
      canResume && h('button', {
        class: 'btn btn--primary btn--big',
        type: 'button',
        'data-fk': 'resume',
        on: { click: ctx.actions.resume },
      }, T.home.resume),
      h('button', {
        class: ['btn btn--big', !canResume && 'btn--primary'],
        type: 'button',
        'data-fk': 'new',
        disabled: !ctx.index,
        on: { click: ctx.actions.newGame },
      }, T.home.newGame),
      h('div', { class: 'home__row' },
        h('button', { class: 'btn', type: 'button', 'data-fk': 'rules', on: { click: ctx.actions.openRules } }, T.home.rules),
        h('button', { class: 'btn', type: 'button', 'data-fk': 'settings', on: { click: ctx.actions.openSettings } }, T.home.settings))),
    h('p', { class: 'home__disclaimer' }, T.disclaimer));
}
