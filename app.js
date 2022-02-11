// globals
if (window.AudioContext === undefined) {
    console.log("Browser cannot load audio.")
    var actx = null
  }
  else {
    var actx = new (window.AudioContext || window.webkitAudioContext);
    actx.listener.setOrientation(0, 1, 0, 0, 0, 1)
  }

  //Classes
  
  class AudioNode {
    constructor(file, angle){
      this.panner = actx.createPanner()
      this.panner.panningModel = "HRTF"
      this.panner.distanceModel = "linear"
    }
  }

  class Trial {
    constructor(trialNum, trialID, targetFile,distLFile,distRFile,promptFile,angle,timeout,MCPrompt,MCChoices,MCCorrect, app){
      
      // setup prompt audio
      this.promptText = "+"
      this.angle = angle

      this.trialID = trialID
      this.trialNum = trialNum

      this.targetFile = targetFile
      this.app = app

      //this.promptAudio = new Audio(promptFile)

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

      //prep multiple choice question
      this.MCText = MCPrompt
      this.MCChoices = MCChoices
      this.MCCorrect = MCCorrect

      this.MCResponse = null
      this.MCStartTime = -1
      this.MCResponseTime = -1
      this.MCTimeSinceExpStarted = -1

      this.trialLog = {}
    }
    
    startTrial(){
      //do the first action-- probably displaying the fixation cross, and playing the promptID
      this.playPrompt()
      
      // init certain data in app
      this.app.mcPrompt = this.MCText
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
      }, 3000);
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
        "mc_correct": this.MCCorrect,
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
      //this.listenerSetup()
      this.startTime = new Date().getTime();
    },
    mounted() {
      //this.loadAudio();
      this.readJson();
    },
    methods: {
      // listenerSetup(){
      //   window.addEventListener('keydown', (e) => {
      //     this.logEvent("keypress",e.key)
      //     if (e.key == 'ArrowLeft') {
      //       this.decrement();
      //     }
      //     if (e.key == 'ArrowRight') {
      //       this.increment();
      //     }
      //   });
      // },

      acceptID(){
        this.state = "INSTRUCT"
        this.setupLog()
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

      confirmInstructions(){
        // initiate the first trial in the list 
        this.state = "TRIAL"
        this.nextTrial()
      },

      nextTrial(){   
        if (this.trials.length > 0) {
          this.trialNum += 1 
          this.current_trial = this.trials.shift()
          this.current_trial.startTrial()
        } else {
          this.state = "END"
          let date = new Date();
          let dateLabel = date.getFullYear() + "-" + date.getMonth() + "-" + date.getDay() + "-" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds();
          let fileName = dateLabel + "_" + this.UID + "_" + "log.txt";
          this.saveTextfile(fileName)
        }
      },

      saveTextfile(filename) {
        let dummy = document.createElement('a');
        dummy.download = filename;
        let log = JSON.parse(window.localStorage.getItem("log"))
        dummy.href = 'data:text/plain;charset=utf-8,' + JSON.stringify(log,null,2);
        dummy.click();
      },
      
      setupLog() {
        this.log = {"UID": this.UID, "trials": []}
        window.localStorage.setItem('log', JSON.stringify(this.log));
      },

      readJson(){
        fetch('./trials.json')
          .then(response => response.json())
          .then(data => this.buildTrials(data));
      },

      buildTrials(data){
        var trial; 
        for (i = 0; i < data.length; i++) {
          console.log(data[i])
          curr_data = data[i];

          trial_id = curr_data["trial_id"];
          targetFile = curr_data["targetFile"];
          distLFile = curr_data["distLFile"];
          distRFile = curr_data["distRFile"];
          promptFile = curr_data["promptFile"];
          angle = curr_data["angle"];
          timeout = curr_data["timeout"];
          mcPrompt = curr_data["mcPrompt"];
          mcChoices = curr_data["mcChoices"];
          mcCorrect = curr_data["mcCorrect"];

          trial = new Trial(trial_id, i + 1, targetFile, distLFile, distRFile, promptFile, angle, timeout, mcPrompt, mcChoices, mcCorrect, this)
          this.trials.push(trial)
        }
    
      }
    }

  })
