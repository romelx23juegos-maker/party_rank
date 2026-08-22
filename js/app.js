var API_URL = 'https://api.animethemes.moe/anime';
var SEASON = 'Summer';
var YEAR = 2026;

var allSongs = [];
var currentIndex = 0;
var currentRating = 0;
var username = '';
var ratings = {};
var isLoading = false;
var useVideoMode = true;

function loadFromStorage() {
  var saved = localStorage.getItem('pr_' + SEASON + YEAR);
  if (saved) {
    try {
      var data = JSON.parse(saved);
      username = data.username || '';
      ratings = data.ratings || {};
      useVideoMode = data.useVideoMode !== undefined ? data.useVideoMode : true;
      document.getElementById('username').value = username;
      if (username) {
        document.getElementById('user-section').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        fetchAnime();
      }
    } catch(e) {}
  }
}

function saveToStorage() {
  localStorage.setItem('pr_' + SEASON + YEAR, JSON.stringify({
    username: username,
    ratings: ratings,
    useVideoMode: useVideoMode,
    timestamp: Date.now()
  }));
}

function showLoading() {
  document.getElementById('loading-spinner').style.display = 'flex';
  document.getElementById('anime-video').style.display = 'none';
  document.getElementById('anime-cover').style.display = 'none';
}

function hideLoading() {
  document.getElementById('loading-spinner').style.display = 'none';
  if (useVideoMode) {
    document.getElementById('anime-video').style.display = 'block';
    document.getElementById('anime-cover').style.display = 'none';
  } else {
    document.getElementById('anime-video').style.display = 'none';
    document.getElementById('anime-cover').style.display = 'block';
  }
}

async function fetchAnime() {
  if (isLoading) return;
  isLoading = true;

  var grid = document.getElementById('anime-grid');
  grid.innerHTML = '<p class="section-header" style="text-align:center;color:#FFD700">Cargando animes...</p>';

  var page = 1;
  var hasMore = true;
  allSongs = [];

  while (hasMore) {
    var url = API_URL + '?include=animethemes.animethemeentries.videos,images&sort=created_at&filter[year]=' + YEAR + '&page[number]=' + page;
    try {
      var res = await fetch(url);
      if (!res.ok) throw new Error('API error ' + res.status);
      var data = await res.json();
      if (!data.anime || data.anime.length === 0) { hasMore = false; break; }

      for (var i = 0; i < data.anime.length; i++) {
        var anime = data.anime[i];
        if (anime.season.toLowerCase() !== SEASON.toLowerCase()) continue;

        var coverImage = null;
        for (var j = 0; j < anime.images.length; j++) {
          if (anime.images[j].facet === 'Large Cover') { coverImage = anime.images[j]; break; }
          if (anime.images[j].facet === 'Small Cover' && !coverImage) coverImage = anime.images[j];
        }
        var coverUrl = coverImage ? coverImage.link : '';

        var addedTypes = {};
        for (var t = 0; t < anime.animethemes.length; t++) {
          var theme = anime.animethemes[t];
          var themeType = theme.type.toUpperCase();
          if (addedTypes[themeType]) continue;

          var entry = theme.animethemeentries[0];
          if (!entry) continue;

          var video = null;
          for (var v = 0; v < entry.videos.length; v++) {
            if (!entry.videos[v].nc) { video = entry.videos[v]; break; }
          }
          if (!video && entry.videos.length > 0) video = entry.videos[0];
          if (!video) continue;

          allSongs.push({
            slug: anime.slug + '-' + theme.slug,
            animeName: anime.name,
            animeSlug: anime.slug,
            type: theme.type,
            sequence: theme.sequence,
            coverUrl: coverUrl,
            videoUrl: video.link,
            entryId: entry.id
          });
          addedTypes[themeType] = true;
        }
      }
      hasMore = data.anime.length === 15;
      page++;
    } catch (err) {
      grid.innerHTML = '<p class="section-header" style="color:#f44336;text-align:center">Error: ' + err.message + '<br><button onclick="fetchAnime()" style="margin-top:10px;padding:8px 16px;cursor:pointer">Reintentar</button></p>';
      isLoading = false;
      return;
    }
  }

  allSongs.sort(function(a, b) {
    if (a.type === 'ED' && b.type !== 'ED') return -1;
    if (a.type !== 'ED' && b.type === 'ED') return 1;
    return a.animeName.localeCompare(b.animeName);
  });

  isLoading = false;
  renderAnimeList();
  updateModeButton();
}

function renderAnimeList() {
  var grid = document.getElementById('anime-grid');
  grid.innerHTML = '';

  if (allSongs.length === 0) return;

  var currentType = '';
  for (var idx = 0; idx < allSongs.length; idx++) {
    var song = allSongs[idx];

    if (song.type !== currentType) {
      currentType = song.type;
      var header = document.createElement('div');
      header.className = 'section-header';
      header.textContent = currentType === 'ED' ? 'ENDINGS' : 'OPENINGS';
      grid.appendChild(header);
    }

    var card = document.createElement('div');
    card.className = 'anime-card';
    if (ratings[song.slug] !== undefined) card.className += ' rated';
    if (idx === currentIndex) card.className += ' playing';

    var ratedText = ratings[song.slug] !== undefined ? '<div class="score">Puntaje: ' + ratings[song.slug].toFixed(2) + '</div>' : '';
    card.innerHTML =
      '<img src="' + (song.coverUrl || '') + '" alt="" onerror="this.style.display=\'none\'">' +
      '<h4>' + esc(song.animeName) + '</h4>' +
      '<div class="song-type">' + song.type + (song.sequence || '') + '</div>' +
      ratedText;

    (function(i) { card.onclick = function() { playSong(i); }; })(idx);
    grid.appendChild(card);
  }
  updateProgress();
}

function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function playSong(idx) {
  currentIndex = idx;
  var song = allSongs[idx];

  document.getElementById('anime-title').textContent = song.animeName;
  document.getElementById('song-name').textContent = song.type + (song.sequence || '');

  showLoading();

  var video = document.getElementById('anime-video');
  var audio = document.getElementById('audio-player');
  var cover = document.getElementById('anime-cover');

  if (useVideoMode) {
    video.poster = song.coverUrl || '';
    video.src = song.videoUrl;
    video.oncanplay = function() { hideLoading(); video.oncanplay = null; };
    video.onerror = function() { hideLoading(); video.onerror = null; };
    video.play().then(function() {
      document.getElementById('btn-play').textContent = '\u23F8';
    }).catch(function() {
      document.getElementById('btn-play').textContent = '\u25B6';
      hideLoading();
    });
  } else {
    cover.src = song.coverUrl || '';
    audio.src = song.videoUrl;
    audio.oncanplay = function() { hideLoading(); audio.oncanplay = null; };
    audio.onerror = function() { hideLoading(); audio.onerror = null; };
    audio.play().then(function() {
      document.getElementById('btn-play').textContent = '\u23F8';
    }).catch(function() {
      document.getElementById('btn-play').textContent = '\u25B6';
      hideLoading();
    });
  }

  currentRating = ratings[song.slug] !== undefined ? ratings[song.slug] : 0;
  updateRatingDisplay();
  renderAnimeList();
  document.getElementById('player-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function togglePlay() {
  if (useVideoMode) {
    var v = document.getElementById('anime-video');
    if (v.paused) { v.play().then(function() { document.getElementById('btn-play').textContent = '\u23F8'; }); }
    else { v.pause(); document.getElementById('btn-play').textContent = '\u25B6'; }
  } else {
    var a = document.getElementById('audio-player');
    if (a.paused) { a.play().then(function() { document.getElementById('btn-play').textContent = '\u23F8'; }); }
    else { a.pause(); document.getElementById('btn-play').textContent = '\u25B6'; }
  }
}

function toggleMute() {
  if (useVideoMode) {
    var v = document.getElementById('anime-video');
    v.muted = !v.muted;
    document.getElementById('btn-mute').textContent = v.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
  } else {
    var a = document.getElementById('audio-player');
    a.muted = !a.muted;
    document.getElementById('btn-mute').textContent = a.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
  }
}

function setVolume(val) {
  var v = val / 100;
  document.getElementById('anime-video').volume = v;
  document.getElementById('audio-player').volume = v;
  document.getElementById('volume-val').textContent = val + '%';
  document.getElementById('btn-mute').textContent = v === 0 ? '\uD83D\uDD07' : '\uD83D\uDD0A';
}

function toggleMode() {
  useVideoMode = !useVideoMode;
  saveToStorage();
  updateModeButton();
  if (allSongs.length > 0) playSong(currentIndex);
}

function updateModeButton() {
  var btn = document.getElementById('btn-mode');
  btn.textContent = useVideoMode ? '\uD83C\uDFAC' : '\uD83C\uDFB5';
  btn.title = useVideoMode ? 'Modo video (click para audio)' : 'Modo audio (click para video)';
  btn.className = useVideoMode ? 'active' : '';
  document.getElementById('anime-video').muted = true;
  document.getElementById('btn-mute').textContent = '\uD83D\uDD07';
}

function prevSong() { if (currentIndex > 0) playSong(currentIndex - 1); }
function nextSong() { if (currentIndex < allSongs.length - 1) playSong(currentIndex + 1); }

function openAnimePage() {
  var song = allSongs[currentIndex];
  if (!song) return;
  var url = 'https://animethemes.moe/anime/' + song.animeSlug;
  window.open(url, '_blank');
}

function setRating(v) {
  currentRating = v;
  updateRatingDisplay();
  if (allSongs[currentIndex]) {
    ratings[allSongs[currentIndex].slug] = currentRating;
    try { saveToStorage(); } catch(e) {}
  }
}

function onDecimalInput(el) {
  var val = el.value.replace(/[^0-9.]/g, '');
  var parts = val.split('.');
  if (parts.length > 2) val = parts[0] + '.' + parts[1];
  if (parts[1] && parts[1].length > 2) val = parts[0] + '.' + parts[1].substring(0, 2);
  el.value = val;

  var num = parseFloat(val);
  if (!isNaN(num) && num >= 0 && num <= 10) {
    currentRating = Math.round(num * 100) / 100;
    updateStarsOnly();
    if (allSongs[currentIndex]) {
      ratings[allSongs[currentIndex].slug] = currentRating;
      try { saveToStorage(); } catch(e) {}
    }
  }
}

function onDecimalKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveAndNext();
  }
}

function setDecimalRating() {
  var val = parseFloat(document.getElementById('decimal-input').value);
  if (!isNaN(val) && val >= 0 && val <= 10) {
    currentRating = Math.round(val * 100) / 100;
    updateRatingDisplay();
  }
}

function updateStarsOnly() {
  var stars = document.querySelectorAll('.star');
  for (var i = 0; i < stars.length; i++) {
    var val = parseInt(stars[i].getAttribute('data-value'));
    stars[i].classList.toggle('active', val <= Math.ceil(currentRating));
  }
  document.getElementById('rating-display').textContent = currentRating.toFixed(2);
}

function updateRatingDisplay() {
  updateStarsOnly();
  var input = document.getElementById('decimal-input');
  if (document.activeElement !== input) {
    input.value = currentRating > 0 ? currentRating.toFixed(2) : '';
  }
}

function saveAndNext() {
  if (currentRating === 0) { alert('Selecciona una puntuacion primero'); return; }
  ratings[allSongs[currentIndex].slug] = currentRating;
  try { saveToStorage(); } catch(e) { console.error('Save error:', e); }
  if (currentIndex < allSongs.length - 1) playSong(currentIndex + 1);
  else alert('Terminaste de votar todos los animes!');
}

window.addEventListener('beforeunload', function() {
  try { saveToStorage(); } catch(e) {}
});

window.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    try { saveToStorage(); } catch(e) {}
  }
});

function updateProgress() {
  var total = allSongs.length;
  var rated = 0;
  for (var k in ratings) { if (ratings[k] !== undefined && ratings[k] > 0) rated++; }
  var pct = total > 0 ? Math.round((rated / total) * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = rated + '/' + total + ' votados';
}

function downloadExcel() {
  if (!username) { alert('Ingresa tu nombre primero'); return; }
  var rated = 0;
  for (var k in ratings) { if (ratings[k] > 0) rated++; }
  if (rated === 0) { alert('No has votado ningun anime aun'); return; }

  var headers = ['Usuario', 'Discord_ID'];
  var slugs = [];
  for (var i = 0; i < allSongs.length; i++) { headers.push(allSongs[i].slug); slugs.push(allSongs[i].slug); }
  var row = [username, ''];
  for (var j = 0; j < slugs.length; j++) { row.push(ratings[slugs[j]] !== undefined ? ratings[slugs[j]] : 0); }

  var ws = XLSX.utils.aoa_to_sheet([headers, row]);
  ws['!cols'] = [{ wch: 15 }, { wch: 20 }].concat(slugs.map(function() { return { wch: 22 }; }));
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Scores');
  XLSX.writeFile(wb, 'party_rank_' + SEASON.toLowerCase() + '_' + YEAR + '_' + username + '.xlsx');
}

function resetAll() {
  if (!confirm('Seguro que quieres reiniciar todo?')) return;
  ratings = {};
  currentRating = 0;
  saveToStorage();
  renderAnimeList();
  if (allSongs.length > 0) playSong(0);
}

function startVoting() {
  username = document.getElementById('username').value.trim();
  if (!username) { alert('Ingresa tu nombre de Discord'); return; }
  saveToStorage();
  document.getElementById('user-section').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';
  fetchAnime();
}

document.addEventListener('keydown', function(e) {
  var active = document.activeElement;
  var isDecimalInput = active && active.id === 'decimal-input';

  if (isDecimalInput) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAndNext();
      return;
    }
    return;
  }

  if (active && active.tagName === 'INPUT') return;

  switch(e.key) {
    case ' ': e.preventDefault(); togglePlay(); break;
    case 'ArrowLeft': prevSong(); break;
    case 'ArrowRight': nextSong(); break;
    case 'Enter': saveAndNext(); break;
  }
});

document.addEventListener('DOMContentLoaded', function() {
  var decimalInput = document.getElementById('decimal-input');
  if (decimalInput) {
    decimalInput.addEventListener('focus', function() {
      var self = this;
      setTimeout(function() { self.select(); }, 50);
    });
  }
});

loadFromStorage();
