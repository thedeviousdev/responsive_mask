/*
Plugin developed by Samara Dionne
samaradionne@gmail.com

Inspiration: https://github.com/preziotte/party-mode
*/

$(document).ready(function() {

    // Set Global Variables 
    var fbc_array, audio, file_name, playlistLength, playlistPos, tempSoundCloudKind;
    var context = source = analyser = soundCloudData = soundCloudKind = null;
    var playing = micStream = soundCloudSong = initialized = demo = uploaded_file = fullscreen = safari = debugMode = false;

    var errorCallback = function(e) {
        console.log('Microphone stream failed', e);
    }

    // Browser tests
    if (/Edge\/\d./i.test(navigator.userAgent)){ // Check if Edge is the browser (has issues with Soundcloud stream)
        if(debugMode) console.log("Browser: Edge");

        $('.sc_upload').remove();
        $('.SC_Wrapper').show();
        $('.up_Wrapper').hide();
    }
    if (!Modernizr.getusermedia) { // Check if browser supports streaming (IE doesn't)
        if(debugMode) console.log("Browser: Doesn't support usermedia");

        $('.support_Table').css('display','table');
        $('.mask_Wrapper').remove();
        $('.song_Wrapper').remove();
        $('.upload_Pop').remove();
    }


    // Controls
    $('#next').on('click', function() { // Next song
        if(debugMode) console.log("Controls: Next song");

        changeSong("next");
    })
    $('#previous').on('click', function() { // Previous song
        if(debugMode) console.log("Controls: Previous song");

        changeSong("previous");
    })

    $('.play').on('click', function() { // Toggle song
        if(debugMode) console.log("Controls: Toggle song");

        songToggle();
    })
    $('.mic').on('click', function() { // Toggle microphone
        if(debugMode) console.log("Controls: Toggle microphone");

        loadMicrophone();
    })
    $('.full').on('click', function() { // Toggle fullscreen
        if (fullscreen) {
            if(debugMode) console.log("Controls: Fullscreen OFF");

            exitFullscreen();
            fullscreen = false;
            $(".full").html('<img src="img/fullscreen.svg" />');
        }
        else {
            if(debugMode) console.log("Controls: Fullscreen ON");

            launchIntoFullscreen(document.documentElement);
            fullscreen = true;
            $(".full").html('<img src="img/compress.svg" />');
        }
    })


    // Pop-up buttons
    function resetForm() { // Clear the form
        $('.upload_Pop form').each(function(){
            $(this).trigger("reset");
            $('.error').hide();
            $('.error_type').hide();
        });    
        $("#drop_zone").html("Drop files here");
        uploaded_file = false;
    }
    $('.upload_Reset').on('click', function() {
        if(debugMode) console.log("Controls: Clear form");

        resetForm();
    })

    $('.upload').on('click', function() { // Open pop-up
        if(debugMode) console.log("Controls: Open pop-up");
        
        $('.upload_Pop').css('display','table');
    });

    $('.close').on('click', function() { // Close pop-up
        if(debugMode) console.log("Controls: Close pop-up");

        $('.upload_Pop').css('display','none');
    })

    $('#show_SC').on('click', function() { // Toggle SoundCloud form
        if(debugMode) console.log("Controls: Toggle SoundCloud form");

        $(".SC_Wrapper").toggle( "slow", function() {});

        if ($(".up_Wrapper").is(":visible"))
            $(".up_Wrapper").toggle( "slow", function() {});
    })

    $('#show_Up').on('click', function() { // Show upload form
        if(debugMode) console.log("Controls: Toggle upload form");

        $(".up_Wrapper").toggle( "slow", function() {});

        if ($(".SC_Wrapper").is(":visible"))
            $(".SC_Wrapper").toggle( "slow", function() {});
    })

    $('#slider-volume').on('input change', function() { // Adjust volume with slider
        audio.volume = (this.value/100);
    });

    $('.submit').on('click', function() { // Upload a file
        if(debugMode) console.log("Controls: Submit clicked");

        var request, tempSoundCloudKind;

        var soundCloudInput = $("#sound_Cloud_Input").val();
        if(debugMode) console.log("Upload: " + soundCloudInput);

        if (document.getElementById("file").files.length != 0) { // If #FILE input is empty, length is 0
            if (!document.getElementById("file").files[0].type.match(/audio.*/)) {
                if(debugMode) console.log("Upload: Incorrect file type");

                $('.up_Wrapper .error').show();
                return;
            }
            $('.upload_Pop').css('display','none');
            playDemo();
            resetForm();
        }
        else if (uploaded_file) { // Uploaded_file is set (via Dragging)
            $('.upload_Pop').css('display','none');
            playDemo();
            resetForm();
        }
        else if (soundCloudInput != "") {
            if (!validateSoundCloud(soundCloudInput)){ // Check if it's a SoundCloud URL
                if(debugMode) console.log("SoundCloud: Invalid URL");

                $('.SC_Wrapper .error').show();
                return;            
            }
            else {
                // Create temp values to check kind of SoundCloud Input
                var tempAudio = new Audio();
                tempAudio.crossOrigin = "anonymous";
                tempAudio.src = soundCloudInput;

                request = $.get('https://api.soundcloud.com/resolve.json?url=' + tempAudio.src + '&client_id=a2f53f703cd43b8e2b2be193f2d13b09').success(function(result) {

                    // If it's a user list, show error
                    if (result.kind == 'user') {
                        if(debugMode) console.log("SoundCloud: Invalid playlist (cannot be a user list)");

                        $('.SC_Wrapper .error_type').show();
                        return;            
                    }

                    $('.upload_Pop').css('display','none');
                    playSoundCloud();
                    resetForm();
                });
            }
        }
        else {
            console.log('No soundcloud or uploaded files');
                if(debugMode) console.log("Controls: No SoundCloud or spload set");
        }
    })


    // Create Audio with anonymous origins (allows CORS) 
    function setUpAudio(a) {
        if(debugMode) console.log("Config: Set up audio");

        audio = new Audio();
        audio.crossOrigin = "anonymous";

        // Check for Safari (doesn't support Microphone streaming)
        if (navigator.userAgent.search("Safari") >= 0 && navigator.userAgent.search("Chrome") < 0) {
            if(debugMode) console.log("Browser: Safari");

            safari = true;
            audio.src = $('#audio').attr('src');
            $('.sc_upload').remove();
            $('.mic').remove();
        }
        else if (uploaded_file) 
            audio.src = $('#audio').attr('src');
        else
            audio.src = a;

        // Create event listeners for playing/ended/paused
        audio.addEventListener('playing', function(){ // playing
            if(debugMode) console.log("Listener: Audio playing");

            $(".song_Title").addClass("marquee");
            playing = true;
            $(".play").html('<img src="img/playing.svg">');
        });

        audio.addEventListener('ended', function(){ // ended
            if(debugMode) console.log("Listener: Audio ended");

            changeSong('next');        
        });

        audio.addEventListener('pause', function(){ // paused
            if(debugMode) console.log("Listener: Audio paused");

            $(".song_Title").removeClass("marquee");
            playing = false;
            $(".play").html('<img src="img/paused.svg">');
        });
    }

    // Set the song title in the span
    function showSongTitle(t) {
        if(debugMode) console.log("Config: Set song title");

        var song = $('.song_Title span');

        if (song.html != t)
            song.html(t);
    }


    // Play the audio 
    function playAudio() {
        audio.play();
        $(".song_Title").addClass("marquee");
        initMp3Player();
    }


    // Load the demo
    function loadDemo() {
        setUpAudio(); // Required to initialized Audio

        if(debugMode) console.log("Config: Load demo");

        if (uploaded_file || safari) {

            if (uploaded_file) // If uploaded file
                showSongTitle(file_name.name);

            else {
                jsmediatags.read(audio.src, { // Otherwise read tags
                  onSuccess: function(tag) {
                    var tags = tag.tags;
                    var temp_title = tags.title + " - " + tags.artist;
                    showSongTitle(temp_title);
                  },
                  onError: function(error) {
                    console.log(error);
                  }
                });
            }
        }
        else 
            playSoundCloud();
    }
    loadDemo();

    // Load Demo (Default SoundCloud then uploaded file)
    function playDemo() {
        song = true;
        resetFrames();
        loadDemo();
        playAudio();
    }


    // Song position in playlist
    function changeSong(s) {

        if (s == 'next') { // Next song
            if (playlistPos < playlistLength - 1 && playlistPos != null) {
                if (playing)
                    audio.pause();

                playlistPos++;
                if(debugMode) console.log('Playlist: Position ' + playlistPos);

                if (soundCloudKind == 'playlist') { // Playlist
                    if(debugMode) console.log("Stream type: SoundCloud playlist");

                    var temp_result = soundCloudData.tracks[playlistPos].uri+'/stream?client_id=a2f53f703cd43b8e2b2be193f2d13b09';
                    setUpAudio(temp_result);

                    showSongTitle(soundCloudData.tracks[playlistPos].title);
                    playAudio();
                }
            }
            else // No other song
                $( "#next" ).effect( "shake" );
        }
        else if (s == 'previous') { // Previous song
            if (playlistPos - 1 > 0) {
                if (playing)
                    audio.pause();

                playlistPos--;
                if(debugMode) console.log('Playlist: Position ' + playlistPos);

                if (soundCloudKind == 'playlist') { // Playlist
                    if(debugMode) console.log("Stream type: SoundCloud playlist");

                    var temp_result = soundCloudData.tracks[playlistPos].uri+'/stream?client_id=a2f53f703cd43b8e2b2be193f2d13b09';
                    setUpAudio(temp_result);

                    showSongTitle(soundCloudData.tracks[playlistPos].title);
                    playAudio();
                }
                else if (soundCloudKind == 'user') { // User
                    if(debugMode) console.log("Stream type: User playlist");

                    var temp_result = soundCloudData[playlistPos].uri+'/stream?client_id=a2f53f703cd43b8e2b2be193f2d13b09';
                    setUpAudio(temp_result);

                    showSongTitle(soundCloudData[playlistPos].title);
                    playAudio();
                }
            }
            else // No other song
                $( "#previous" ).effect( "shake" );
        }
    }


    // Reset animation
    function resetFrames() {
        initialized = false;
        soundCloudSong = false;

        for (var i = 1; i < 7; i++)
            $("#step_" + i).hide();

        $(".song_Title").removeClass("marquee");
      }

    function frameLooper(){

        requestAnimationFrame(frameLooper);
        fbc_array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(fbc_array);

        if (playing) { // If animation is playing, keep re-evaluating min & max values for averages
            var largest = Math.max.apply( Math, fbc_array );
            var total = 0;

            for (var j = 0; j < fbc_array.length; j++)
                total += fbc_array[j];

            var average = total / fbc_array.length;
            var step_1, step_2, step_3, step_4, step_5, step_6 = 0;


            if (average > 77) {
                step_0 = 85;
                step_1 = 90;
                step_2 = 95;
                step_3 = 100;
                step_4 = 105;
                step_5 = 110;
                step_6 = 115;
            }
            else if (average > 45) {
                step_0 = 50;
                step_1 = 55;
                step_2 = 60;
                step_3 = 70;
                step_4 = 74;
                step_5 = 77;
                step_6 = 77;
            }
            else if (average <= 6) {
                step_0 = .5;
                step_1 = 1;
                step_2 = 2;
                step_3 = 3;
                step_4 = 4;
                step_5 = 5;
                step_6 = 6;
            }
            else if (average <= 19) {
                step_0 = 6;
                step_1 = 8;
                step_2 = 10;
                step_3 = 12;
                step_4 = 14;
                step_5 = 16;
                step_6 = 18;
            }
            else if (average <= 45) {
                step_0 = 20;
                step_1 = 25;
                step_2 = 30;
                step_3 = 33;
                step_4 = 36;
                step_5 = 38;
                step_6 = 38;
            }

            if (average <= step_0) {
                $('#step_1').hide();
                $('#step_2').hide();
                $('#step_3').hide();
                $('#step_4').hide();
                $('#step_5').hide();
                $('#step_6').hide();
            }
            else if (average <= step_1) {
                $('#step_1').show();
                $('#step_2').hide();
                $('#step_3').hide();
                $('#step_4').hide();
                $('#step_5').hide();
                $('#step_6').hide();
            }
            else if (average <= step_2) {
                $('#step_1').show();
                $('#step_2').show();
                $('#step_3').hide();
                $('#step_4').hide();
                $('#step_5').hide();
                $('#step_6').hide();
            }
            else if (average <= step_3) {
                $('#step_1').show();
                $('#step_2').show();
                $('#step_3').show();
                $('#step_4').hide();
                $('#step_5').hide();
                $('#step_6').hide();
            }
            else if (average <= step_4) {
                $('#step_1').show();
                $('#step_2').show();
                $('#step_3').show();
                $('#step_4').show();
                $('#step_5').hide();
                $('#step_6').hide();
            }
            else if (average <= step_5) {
                $('#step_1').show();
                $('#step_2').show();
                $('#step_3').show();
                $('#step_4').show();
                $('#step_5').show();
                $('#step_6').hide();
            }
            else if (average > step_6) {
                $('#step_1').show();
                $('#step_2').show();
                $('#step_3').show();
                $('#step_4').show();
                $('#step_5').show();
                $('#step_6').show();
            }
        }
    }

    // Load SoundCloud
    function playSoundCloud() {
        song = true;
        resetFrames();

        if (safari) {
            loadDemo();
            return; 
        }

        soundCloudSong = true;
        if (micStream)
            loadMicrophone();

        var soundCloudInput = $('#sound_Cloud_Input').val();

        if (soundCloudInput != "")
            audio.src = soundCloudInput;
        else // Change this if client wants to change the playlist
            audio.src = 'https://soundcloud.com/outline-montreal/sets/jaguar-mk-1';

        $.get('https://api.soundcloud.com/resolve.json?url=' + audio.src + '&client_id=a2f53f703cd43b8e2b2be193f2d13b09', function (result) {
                if(debugMode) {
                    console.log("SoundCloud: " + result.kind + " loaded");
                    console.log(result);
                }

                soundCloudData = result;
                soundCloudKind = soundCloudData.kind;

                if (soundCloudKind == "track") { // If individual track                
                    playlistLength = 0;
                    var temp_result = soundCloudData.uri+'/stream?client_id=a2f53f703cd43b8e2b2be193f2d13b09';
                    setUpAudio(temp_result);

                    showSongTitle(soundCloudData.title);
                    playAudio();
                }
                else if (soundCloudKind == "playlist") { // If playlist
                    playlistLength = soundCloudData.tracks.length;
                    playlistPos = 0;

                    var temp_result = soundCloudData.tracks[0].uri+'/stream?client_id=a2f53f703cd43b8e2b2be193f2d13b09';
                    setUpAudio(temp_result);

                    showSongTitle(soundCloudData.tracks[0].title);
                    playAudio();
                }
                else {
                    soundCloudKind = null;
                }

            }
        );
    }

    // Toggle play, pause & intialize of Audio
    function songToggle() {
        var soundCloudInput = $("#sound_Cloud_Input").val();

        if (micStream) { // Stop microphone streaming and resume the song
            if(debugMode) console.log('Controls: Stop microphone, resume song');

            loadMicrophone();
            if (soundCloudSong)
                playSoundCloud();
            else
                playDemo();
        }
        else {
            if (playing) {
                if(debugMode) console.log('Controls: Pause');

                audio.pause();
            }
            else {
                if(debugMode) console.log('Controls: Play');

                if (!initialized && soundCloudInput != '')
                    playSoundCloud();
                else if (!initialized)
                    playDemo();  
                else
                    audio.play();

                if (!initialized)
                    initMp3Player();
            }
        }
    }


    function initMp3Player(){
        if(debugMode) console.log('Config: Initialize audio context');

        if (context != null)
            context.close();

        context = new(window.AudioContext || window.webkitAudioContext)();
        analyser = context.createAnalyser();

        if (micStream) 
            source = context.createMediaStreamSource(stream);
        else
            source = context.createMediaElementSource(audio);
        source.connect(analyser);

        if (!micStream)
            analyser.connect(context.destination);

        initialized = true;
        frameLooper();
    }

    function loadMicrophone() {
        audio.pause();
        if (context != null) // Close context or else issues with multiple open contexts
            context.close();

        song = false;
        resetFrames();

        if (!micStream) {
            if(debugMode) console.log('Config: Initialize microphone');

            navigator.getUserMedia  = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

            navigator.getUserMedia({audio: true, video: false}, function(s) {
                stream = s;
                micStream = true;
                playing = true;
                initMp3Player();
                frameLooper();
            }, errorCallback);
        }
        else {
            if(debugMode) console.log('Config: Disconnect microphone');

            source.disconnect();
            micStream = false;
            playing = false;
            initialized = false;
        }
    }

    // Regex checker for SoundCloud URL
    // http://stackoverflow.com/questions/18227087/validate-soundcloud-url-via-javascript-regex
    function validateSoundCloud(url){
        var regexp = /^https?:\/\/(soundcloud\.com|snd\.sc)\/(.*)$/;
        return url.match(regexp) && url.match(regexp)[2];
    }


    // Fullscreen (F11) Modes
    // https://davidwalsh.name/fullscreen
    function launchIntoFullscreen(element) {
        if(element.requestFullscreen)
            element.requestFullscreen();
        else if(element.mozRequestFullScreen)
            element.mozRequestFullScreen();
        else if(element.webkitRequestFullscreen)
            element.webkitRequestFullscreen();
        else if(element.msRequestFullscreen)
            element.msRequestFullscreen();
    }

    function exitFullscreen() {
        if(document.exitFullscreen)
            document.exitFullscreen();
        else if(document.mozCancelFullScreen)
            document.mozCancelFullScreen();
        else if(document.webkitExitFullscreen)
            document.webkitExitFullscreen();
        else 
            exitFullscreen();
    }


    // Get file from input
    function playFile(obj) {
        uploaded_file = true;
        var sound = document.getElementById('audio');

        URL.revokeObjectURL(objectUrl); 
        file_name =  $('#file')[0].files[0];
        var objectUrl = URL.createObjectURL(file_name);
        console.log(objectUrl);
        sound.setAttribute('src',objectUrl);
    }
    // Add event listener to file input
    document.getElementById('file').addEventListener('change', playFile, false);

    /*
    filedrag.js - HTML5 File Drag & Drop demonstration
    Featured on SitePoint.com
    Developed by Craig Buckler (@craigbuckler) of OptimalWorks.net
    */

    // getElementById
    function $id(id) {
      return document.getElementById(id);
    }

    // output information
    function Output(msg) {
      var m = $id("drop_zone");
      $('#drop_zone').html(msg);
    }

    // file drag hover
    function FileDragHover(e) {
      e.stopPropagation();
      e.preventDefault();
      e.target.className = (e.type == "dragover" ? "hover" : "");
    }

    // file selection
    function FileSelectHandler(e) {

      // cancel event and hover styling
      FileDragHover(e);

      // fetch FileList object
      var files = e.target.files || e.dataTransfer.files;

      // process all File objects
      ParseFile(files[0]);
      console.log(files[0]);

    }

    // output file information
    function ParseFile(file) {
        uploaded_file = true;
        file_name =  file;
        $('#audio').attr('src', window.URL.createObjectURL(file));

        Output(file.name);
    }

    // initialize
    function Init() {

      var fileselect = $id("file"),
        filedrag = $id("drop_zone"),
        submitbutton = $id("submit");

        fileselect.addEventListener("change", FileSelectHandler, false);

        // is XHR2 available?
        var xhr = new XMLHttpRequest();
        if (xhr.upload) {

          // file drop
          filedrag.addEventListener("dragover", FileDragHover, false);
          filedrag.addEventListener("dragleave", FileDragHover, false);
          filedrag.addEventListener("drop", FileSelectHandler, false);
          filedrag.style.display = "block";
        }
    }

    // call initialization file
    if (window.File && window.FileList && window.FileReader) {
        Init();
    }

});

// Hide the UI if the mouse is not moving
var timeoutid = 0;
$("html").mousemove(function() {

    $(".song_Wrapper").css('opacity', 1);
    clearTimeout(timeoutid);
    timeoutid = setTimeout(hideUI, 2000);
});

function hideUI() {
    $(".song_Wrapper").css('opacity', 0);
};

// Bind ESC to usual functions
$(document).keyup(function(e) {
    console.log("Controls: ESC pressed");

    if (e.keyCode === 27) {
        fullscreen = false;
        $(".full").html('<img src="img/fullscreen.svg" />');
        $('.upload_Pop').css('display','none');
    }
});