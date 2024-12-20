import { type SortableEvent } from 'sortablejs';
import player from '../lib/player';
import { getSaved, params, store } from '../lib/store';
import { downloader, idFromURL, notify } from '../lib/utils';
import { bitrateSelector, searchFilters, superInput, audio, loadingScreen, ytifyIcon, queuelist } from '../lib/dom';
import fetchList from '../modules/fetchList';
import { fetchCollection } from "../lib/libraryUtils";

export default async function() {

  const custom_instance = getSaved('custom_instance_2');
  const a = store.api;

  if (custom_instance) {
    const [pi, iv] = custom_instance.split(',');
    a.piped.push(pi);
    a.invidious.push(iv);

  } else {
    const apiUrl = 'https://shashwat-coding.github.io/Shashwat-CODER-Music/list.json';
    await fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        a.piped = data.piped;
        a.invidious = data.invidious;
        a.unified = data.unified;
      });
  }



  // hls

  if (getSaved('HLS')) {
    // handling bitrates with HLS will increase complexity, better to detach from DOM
    bitrateSelector.remove();

    if (!store.player.legacy)
      import('hls.js')
        .then(mod => {
          store.player.HLS = new mod.default();
          const h = store.player.HLS;
          h.attachMedia(audio);
          h.on(mod.default.Events.MANIFEST_PARSED, () => {
            h.currentLevel = store.player.hq ?
              h.levels.findIndex(l => l.audioCodec === 'mp4a.40.2') : 0;
            audio.play();
          });
          h.on(mod.default.Events.ERROR, (_, d) => {

            if (d.details === 'manifestLoadError') {
              const hlsUrl = store.player.data!.hls;
              const piProxy = (new URL(hlsUrl)).origin;
              const defProxy = 'https://invidious.jing.rocks';

              if (piProxy === defProxy) {
                notify(d.details);
                return;
              }
              const newUrl = hlsUrl.replace(piProxy, defProxy);
              h.loadSource(newUrl);
            }
            else {
              notify('load error, retrying...')
              player(store.stream.id);
            }

          })
        })
  }
  else bitrateSelector.addEventListener('change', () => {
    if (store.player.playbackState === 'playing')
      audio.pause();
    const timeOfSwitch = audio.currentTime;
    audio.src = bitrateSelector.value;
    audio.currentTime = timeOfSwitch;
    audio.play();
  });



  // params handling

  const isPWA = idFromURL(params.get('url') || params.get('text'));
  const id = params.get('s') || isPWA;
  let shareAction = getSaved('shareAction');
  if (isPWA && shareAction === 'ask')
    shareAction = confirm('Click ok to Play, click cancel to Download') ?
      '' : 'dl';



  if (id) {
    loadingScreen.showModal();
    if (isPWA && shareAction) {
      await downloader(id);
    }
    else await player(id)

    loadingScreen.close();
  }
  else document.getElementById('ytifyIconContainer')?.prepend(ytifyIcon);

  if (params.has('q')) {
    superInput.value = params.get('q') || '';
    if (params.has('f'))
      searchFilters.value = params.get('f') || '';
    superInput.dispatchEvent(new KeyboardEvent('keydown', { 'key': 'Enter' }));
  }

  fetchCollection(params.get('collection'));


  // list loading

  if (params.has('channel') || params.has('playlists'))
    fetchList('/' +
      location.search
        .substring(1)
        .split('=')
        .join('/')
    );



  // queue sorting

  await import('sortablejs')
    .then(mod =>
      new mod.default(queuelist, {
        handle: '.ri-draggable',
        onUpdate(e: SortableEvent) {
          if (e.oldIndex == null || e.newIndex == null) return;
          const queueArray = store.queue;
          queueArray.splice(e.newIndex, 0, queueArray.splice(e.oldIndex, 1)[0]);
        }
      })
    );


}
