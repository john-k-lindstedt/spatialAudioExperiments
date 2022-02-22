// globals

if (window.AudioContext === undefined) {
    console.log("Browser cannot load audio.")
    var actx = null
  }
  else {
    var actx = new (window.AudioContext || window.webkitAudioContext);
    actx.listener.setOrientation(0, 1, 0, 0, 0, 1)
  }

  class Trial {
    constructor(trialID,targetFile,distLFile,distRFile,promptFile,angle,timeout,MCPrompt,MCChoices,app){
      
      // setting instance variables
      this.trialID = trialID
      this.targetFile = targetFile
      this.distLFile = distLFile
      this.distRFile = distRFile
      this.promptFile = promptFile
      this.angle = angle
      this.timeout = timeout * 1000
      this.MCPrompt = MCPrompt
      this.MCChoices = MCChoices
      this.app = app

      // set up prompt audio
      this.promptAudio = new Audio(promptFile)
      this.promptAudio.loop = true
      this.promptSource = actx.createMediaElementSource(this.promptAudio)

      // setup target audio
      this.targetPanner = actx.createPanner()
      this.targetPanner.panningModel = "HRTF"
      this.targetPanner.distanceModel = "linear"

      this.targetX = 10 * Math.cos((-90) * Math.PI / 180)
      this.targetY = 10 * Math.sin((-90) * Math.PI / 180)
      this.targetPanner.setPosition(this.targetX,this.targetY,0)

      this.targetAudio = new Audio(targetFile)
      this.targetAudio.loop = true
      this.targetSource = actx.createMediaElementSource(this.targetAudio)
      this.targetSource.connect(this.targetPanner)

      // setup left distractor audio
      this.distLPanner = actx.createPanner()
      this.distLPanner.panningModel = "HRTF"
      this.distLPanner.distanceModel = "linear"

      this.distLX = 10 * Math.cos((-angle - 90) * Math.PI / 180)
      this.distLY = 10 * Math.sin((-angle - 90) * Math.PI / 180)
      this.distLPanner.setPosition(this.distLX,this.distLY,0)

      this.distLAudio = new Audio(distLFile)
      this.distLAudio.loop = true
      this.distLSource = actx.createMediaElementSource(this.distLAudio)
      this.distLSource.connect(this.distLPanner)

      // setup right distractor audio
      this.distRPanner = actx.createPanner()
      this.distRPanner.panningModel = "HRTF"
      this.distRPanner.distanceModel = "linear"

      this.distRX = 10 * Math.cos((angle - 90) * Math.PI / 180)
      this.distRY = 10 * Math.sin((angle - 90) * Math.PI / 180)
      this.distRPanner.setPosition(this.distRX,this.distRY,0)

      this.distRAudio = new Audio(distRFile)
      this.distRAudio.loop = true
      this.distRSource = actx.createMediaElementSource(this.distRAudio)
      this.distRSource.connect(this.distRPanner)

      //prep stress likert
      this.stressText = "How hard was it to track the target voice?"
      this.efReponse = null
      this.efStartTime = -1
      this.efResponseTime = -1
      this.efTimeSinceExpStarted = -1

      this.MCResponse = null
      this.MCStartTime = -1
      this.MCResponseTime = -1
      this.MCTimeSinceExpStarted = -1
    }
    
    startTrial(){
      //do the first action-- probably displaying the fixation cross, and playing the promptID
      this.playPrompt()
      
      // init certain data in app
      this.app.mcPrompt = this.MCPrompt
      this.app.mcChoices = this.MCChoices
      //then set the timeout for the NEXT action (playing the trial audio proper)
    }
    
    playPrompt() {
      this.app.substate = "PROMPT"
      this.promptSource.connect(actx.destination)
      
      this.promptAudio.play()
      
      //when should I disconnect...?
      setTimeout(() => { this.stopPrompt(); }, 1000);
    }

    stopPrompt() {
      this.promptAudio.pause()
      this.promptAudio.currentTime = 0
      this.playTrial()
    }

    playTrial(){
      this.app.substate = "AUDIO"

      this.targetPanner.connect(actx.destination)
      this.distLPanner.connect(actx.destination)
      this.distRPanner.connect(actx.destination)

      this.targetAudio.play()
      this.distLAudio.play()
      this.distRAudio.play()
      
      //after starting, set a timeout for "stopAll()"
      setTimeout(() => { 
        this.stopAll(); 
        //but ALSO for "advance to effortPrompt"
        this.efStartTime = new Date().getTime();
        this.app.substate = "EF"
      }, this.timeout);
    }
    
    stopAll(){
      this.targetAudio.pause()
      this.targetAudio.currentTime = 0

      this.distLAudio.pause()
      this.distLAudio.currentTime = 0

      this.distRAudio.pause()
      this.distRAudio.currentTime = 0
    }

    logTrial() {
      this.app.log["trials"].push({
        "timestamp": Math.floor(Date.now() / 1000),
        "trialNum": this.trialNum,
        "stimulusId": this.trialID,
        "angle": this.angle,
        "target_file": this.targetFile,
        "ef_rate": this.efReponse,
        "ef_react": this.efResponseTime,
        "ef_time_since_exp_started": this.efTimeSinceExpStarted,
        "mc_choice": this.MCResponse,
        "mc_react": this.MCResponseTime,
        "mc_time_since_exp_started": this.MCTimeSinceExpStarted,
        }
      )
      window.localStorage.setItem('log', JSON.stringify(this.app.log));
    }
  }

  app = new Vue({
    el: "#app",
    startTime: -1,
    data:{
      state: "ENTER_ID",
      substate: "",
      trial_id: 0,
      trials: [],
      current_trial: null,
      UID: "",
      UIDEntered: false,
      log: null,
      stimulus: "",
      mcPrompt: "",
      trialNum: 0,
      efAnswers: ["0","1","2","3","4","5","6","7","8","9"],
      mcChoices: [],
      instructions: [
        "Try to listen closely to the audio in each trial to come.",
        "Focus on the CENTER voice.",
        "After listening for a few seconds, we'll ask you some comprehension questions."
      ]
    },

    created() {
      this.startTime = new Date().getTime();
    },

    mounted() {
      this.readTsv();
    },
    
    methods: {

    // ----- STATE TRANSITIONS ---- //
      acceptID() {
        this.state = "INSTRUCT"
        this.setupLog()
      },

      confirmInstructions(){
        // initiate the first trial in the list 
        this.state = "TRIAL"
        this.nextTrial()
      },

      efDone(answer) {
        let time = new Date().getTime();
        this.current_trial.efResponseTime = time - this.current_trial.efStartTime;
        this.current_trial.efTimeSinceExpStarted = time - this.startTime;
        this.current_trial.efReponse = answer

        this.current_trial.MCStartTime = new Date().getTime(); 
        this.substate = "MC"
      },

      mcDone(answer) {
        let time = new Date().getTime();
        this.current_trial.MCResponseTime = time - this.current_trial.MCStartTime;
        this.current_trial.MCTimeSinceExpStarted = time - this.startTime;
        this.current_trial.MCResponse = answer

        this.current_trial.logTrial()
        this.nextTrial()
      },

    // ----- STARTING TRIALS ---- //

      nextTrial(){   
        if (this.trials.length > 0) {
          this.trialNum += 1 
          this.current_trial = this.trials.shift()
          console.log(this.current_trial.targetFile)
          this.current_trial.startTrial()
        } else {
          this.state = "END"
          let date = new Date();
          let dateLabel = date.getFullYear() + "-" + date.getMonth() + "-" + date.getDay() + "-" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds();
          let fileName = dateLabel + "_" + this.UID + "_" + "log.txt";
          this.saveTextfile(fileName)
        }
      },

    // ----- SETTING UP LOG ---- //

      setupLog() {
        this.log = {"UID": this.UID, "trials": []}
        window.localStorage.setItem('log', JSON.stringify(this.log));
      },

      saveTextfile(filename) {
        let log = JSON.parse(window.localStorage.getItem("log"))
        const blob = new Blob([JSON.stringify(log, null, 2)], {type : 'plain/text'});
        blobURL = URL.createObjectURL(blob);
        var href = document.createElement("a");
        href.href = blobURL;
        href.download = filename;
        href.click();
      },
      
    // ----- READING EXPERIMENT DEFINITION ---- //

      readTsv() {
        fetch('experiment_def.tsv')
          .then(response => response.text())
          .then(data => {
            this.parseTsv(data)
          });
      },

      parseTsv(data) {
        var x = data.split('\n');
        for (var i=0; i<x.length; i++) {
            y = x[i].split('\t');
            x[i] = y;
        }
        console.log(x);
        // need to build trials using x
        this.buildTrials(x);
      },

      buildTrials(data) {
        for (var i = 1; i < data.length; i++) {
          curr_data = data[i];

          // getting all data from tsv
          trial_id = curr_data[0];
          talker_id = curr_data[1];
          target_audio_num = curr_data[2];
          distL_audio_num = curr_data[3];
          distR_audio_num = curr_data[4];
          angle = curr_data[5];
          duration = parseInt(curr_data[6]);
          prompt_text = curr_data[7];
          mc_choices = [curr_data[8], curr_data[9], curr_data[10], curr_data[11]]

          // converting to audio files
          target_audio_file = this.getAudioFile(target_audio_num)
          distL_audio_file = this.getAudioFile(distL_audio_num)
          distR_audio_file = this.getAudioFile(distR_audio_num)

          var trial = new Trial(trial_id, target_audio_file, distL_audio_file, distR_audio_file, "audioFiles/p54_emw.ogg", angle, duration, prompt_text, this.shuffle(mc_choices), this)
          this.trials.push(trial)
        }
        // randomize trials 
        this.shuffle(this.trials)
      }, 


    // ----- HELPER FUNCTIONS ----- // 

      shuffle(array) {
        let currentIndex = array.length, randomIndex;
      
        // While there remain elements to shuffle...
        while (currentIndex != 0) {
      
          // Pick a remaining element...
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;
      
          // And swap it with the current element.
          [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
        }
      
        return array;
      },

      getAudioFile(audio_num) {
        let num_string = audio_num.substring(1);
        let num_int = parseInt(num_string);

        let audio_file = "audioFiles/" + audio_num;

        if (num_int <= 20) {
          audio_file += "_" + "jkl" + ".ogg"
        } else if (num_int <= 40) {
          audio_file += "_" + "alc" + ".ogg"
        } else {
          audio_file += "_" + "emw" + ".ogg"
        }

        return audio_file;
      }
      
    }

  })
