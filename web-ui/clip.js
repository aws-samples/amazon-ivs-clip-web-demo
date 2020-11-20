/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// Configuration
let playbackUrl = '';
let clipEndpoint = '';

let startApp = function(){
  // Elements
  const playerOverlay = document.getElementById("overlay");
  const playerControls = document.getElementById("player-controls");
  const btnPlay = document.getElementById("play");
  const btnMute = document.getElementById("mute");
  const btnClip = document.getElementById("clip");
  const btnSettings = document.getElementById("settings");
  const settingsMenu = document.getElementById("settings-menu");
  const clipsEls = document.getElementById("clips-els");
  const clipTemplate = document.getElementById("clip-template");
  const clipIcon = document.getElementById("clip_icon");
  const clipSpinner = document.getElementById("clip_spinner");

  // App
  const videoPlayer = document.getElementById("video-player");
  const clientId = `${Math.random().toString().slice(2)}${Math.random().toString().slice(2)}`;

  // Btn icons
  let setBtnPaused = function(){
    btnPlay.classList.remove("btn--play");
    btnPlay.classList.add("btn--pause");
  };

  let setBtnPlay = function(){
    btnPlay.classList.add("btn--play");
    btnPlay.classList.remove("btn--pause");
  };

  let setBtnMute = function(){
    btnMute.classList.remove("btn--mute");
    btnMute.classList.add("btn--unmute");
  };

  let setBtnUnmute = function(){
    btnMute.classList.add("btn--mute");
    btnMute.classList.remove("btn--unmute");
  };

  // Player
  (function (IVSPlayer) {
    const PlayerState = IVSPlayer.PlayerState;
    const PlayerEventType = IVSPlayer.PlayerEventType;

    // Initialize player
    const player = IVSPlayer.create();
    player.attachHTMLVideoElement(videoPlayer);

    player.addEventListener(PlayerEventType.TEXT_METADATA_CUE, function (cue) {
      const metadataText = cue.text;
      const position = player.getPosition().toFixed(2);
      console.log(
        `Player Event - TEXT_METADATA_CUE: "${metadataText}". Observed ${position}s after playback started.`
      );
    });

    player.addEventListener(PlayerEventType.AUDIO_BLOCKED, function(){
      setBtnMute();
    });

    // Setup stream and play
    player.setAutoplay(true);
    player.load(playbackUrl);

    // Controls events
    // Play/Pause
    btnPlay.addEventListener(
      "click",
      function (e) {
        if (btnPlay.classList.contains("btn--play")) {
          // change to pause
          setBtnPaused();
          player.pause();
        } else {
          // change to play
          setBtnPlay();
          player.play();
        }
      },
      false
    );

    // Mute/Unmute
    btnMute.addEventListener(
      "click",
      function (e) {
        if (btnMute.classList.contains("btn--mute")) {
          setBtnMute();
          player.setMuted(1);
        } else {
          setBtnUnmute();
          player.setMuted(0);
        }
      },
      false
    );

    // Create Quality Options
    let createQualityOptions = function (obj, i) {
      let q = document.createElement("a");
      let qText = document.createTextNode(obj.name);
      settingsMenu.appendChild(q);
      q.classList.add("settings-menu-item");
      q.appendChild(qText);

      q.addEventListener("click", (event) => {
        player.setQuality(obj);
        return false;
      });
    };

    // Close Settings menu
    let closeSettingsMenu = function () {
      btnSettings.classList.remove("btn--settings-on");
      btnSettings.classList.add("btn--settings-off");
      settingsMenu.classList.remove("open");
    };

    // Settings
    btnSettings.addEventListener(
      "click",
      function (e) {
        let qualities = player.getQualities();
        let currentQuality = player.getQuality();

        // Empty Settings menu
        while (settingsMenu.firstChild)
          settingsMenu.removeChild(settingsMenu.firstChild);

        if (btnSettings.classList.contains("btn--settings-off")) {
          for (var i = 0; i < qualities.length; i++) {
            createQualityOptions(qualities[i], i);
          }
          btnSettings.classList.remove("btn--settings-off");
          btnSettings.classList.add("btn--settings-on");
          settingsMenu.classList.add("open");
        } else {
          closeSettingsMenu();
        }
      },
      false
    );

    // Close Settings menu if user clicks outside the player
    window.addEventListener("click", function (e) {
      if (playerOverlay.contains(e.target)) {
      } else {
        closeSettingsMenu();
      }
    });

    // Clip
    btnClip.addEventListener(
      "click",
      function (e) {
        createClip();
      },
      false
    );

    // Create Clip
    let createClip = function (time) {
      const url = clipEndpoint;

      clipIcon.classList.add("hidden");
      clipSpinner.classList.remove("hidden");

      var call = new XMLHttpRequest();
      call.responseType = "json";
      call.open("GET", url, true);
      call.onload = function () {
        clipSrc = call.response.URL;
        displayClip(clipSrc);
        clipIcon.classList.remove("hidden");
        clipSpinner.classList.add("hidden");
      };
      call.send("null");
    };

    // Copy btn
    let copybtnClickHandler = function(src) {
      navigator.clipboard.writeText(src).then(function() {
        alert("Copied to clipboard!");
      }, function(err) {
        console.error('Failed to copy!', err);
      });
    };

    // Share btn
    let sharebtnClickHandler = function(src) {
      navigator.share({
        title: 'Amazon IVS Clip',
        text: 'Check out the clip I made!',
        url: src,
      });
    };

    // Open btn
    let openbtnClickHandler = function(src) {
      window.open(src, '_blank');
    };

    // Handle Clip play
    let handleClipPlay = function(){
      setBtnMute();
      setBtnPaused();
      player.setMuted(1);
      player.pause();
    };

    // Display Clip
    let displayClip = function (src) {
      let receptacle = clipsEls;
      let template = clipTemplate;
      let clone = template.content.cloneNode(true);
      let clone_player = clone.querySelectorAll('.clip-el__player');
      let clone_copy_btn = clone.querySelectorAll('.clip-el__copy');
      let clone_share_btn = clone.querySelectorAll('.clip-el__share');
      let clone_open_btn = clone.querySelectorAll('.clip-el__open');

      // pause all clips
      document.querySelectorAll('.clip-el__player').forEach(clip => clip.pause());

      // create player
      clone_player[0].setAttribute("src", src);
      clone_player[0].load();
      clone_player[0].pause();
      clone_player[0].onplay = function(e){handleClipPlay()};
      
      // copy to clipboard
      clone_copy_btn[0].addEventListener("click", function(e){copybtnClickHandler(src)}, false);
      
      // share
      if (navigator.canShare){
        clone_share_btn[0].classList.remove("hidden");
        clone_share_btn[0].addEventListener("click", function(e){sharebtnClickHandler(src)}, false);
      }
      
      // open
      clone_open_btn[0].addEventListener("click", function(e){openbtnClickHandler(src)}, false);
      
      // append
      receptacle.appendChild(clone);

    };

  })(window.IVSPlayer);
}

// Update values
fetch('config.json')
.then(response => response.json())
.then(data => {
  playbackUrl = data.playbackURL;
  clipEndpoint = data.api + '/clip?channel='+ playbackUrl;
  startApp();
});