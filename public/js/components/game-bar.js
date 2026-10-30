// Barra in alto durante la partita: logo, un elemento centrale (turno o titolo), Annulla, audio, schermo intero, menu.
import { h } from '../dom.js';
import { T } from '../strings.js';
import { canUndo } from '../rules.js';

export function gameBar(ctx, middle) {
  const sound = ctx.store.settings.sound;
  return h('header', { class: 'game__bar' },
    h('span', { class: 'game__logo' }, T.appName),
    middle,
    h('span', { class: 'game__tools' },
      h('button', {
        class: 'btn btn--small',
        type: 'button',
        'data-fk': 'undo',
        title: 'Ctrl+Z',
        disabled: !canUndo(ctx.store.game),
        on: { click: () => ctx.dispatch({ type: 'UNDO' }) },
      }, `↶ ${T.board.undo}`),
      h('button', {
        class: 'btn btn--small btn--icon',
        type: 'button',
        'data-fk': 'sound',
        title: sound ? T.board.soundOn : T.board.soundOff,
        'aria-label': sound ? T.board.soundOn : T.board.soundOff,
        on: { click: ctx.actions.toggleSound },
      }, sound ? '🔊' : '🔇'),
      h('button', { class: 'btn btn--small', type: 'button', 'data-fk': 'fullscreen', title: 'F', on: { click: ctx.actions.toggleFullscreen } }, `⛶ ${T.board.fullscreen}`),
      h('button', { class: 'btn btn--small', type: 'button', 'data-fk': 'menu', on: { click: ctx.actions.openMenu } }, `⚙ ${T.board.menu}`)));
}
