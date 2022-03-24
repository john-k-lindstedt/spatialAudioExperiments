if (window.AudioContext === undefined) {
  console.log("Browser cannot load audio.");
  var actx = null;
} else {
  var actx = new (window.AudioContext || window.webkitAudioContext)();
  actx.listener.setOrientation(0, 1, 0, 0, 0, 1);
}

class AudioNode {
  constructor(file, angle, loop){
    this.file = file
    this.angle = angle
    this.loop = loop

    this.panner = actx.createPanner()
    this.panner.panningModel = "HRTF"
    this.panner.distanceModel = "inverse"
  }

  setCenterAudio() {
    let targetX = 10 * Math.cos((-90 * Math.PI) / 180);
    let targetY = 10 * Math.sin((-90 * Math.PI) / 180);
    this.panner.setPosition(targetX, targetY, 0);
    this.setUpAudio();
  }

  setLeftAudio() {
    let targetX = 10 * Math.cos(((-this.angle - 90) * Math.PI) / 180);
    let targetY = 10 * Math.sin(((-this.angle - 90) * Math.PI) / 180);
    this.panner.setPosition(targetX, targetY, 0);  
    this.setUpAudio();
  }

  setRightAudio() {
    let targetX = 10 * Math.cos(((this.angle - 90) * Math.PI) / 180);
    let targetY = 10 * Math.sin(((this.angle - 90) * Math.PI) / 180);
    this.panner.setPosition(targetX, targetY, 0);  
    this.setUpAudio();
  }

  setUpAudio() {
    this.audio = new Audio(this.file);
    this.audio.loop = this.loop;
    this.source = actx.createMediaElementSource(this.audio);
    this.source.connect(this.panner);
  }

  playAudio() {
    this.panner.connect(actx.destination);
    this.audio.play();
  }

  stopAudio() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}

class TrialDemos {
  constructor(app) {
    const prompt1 = "audioFiles/prompts/id_alc.ogg"
    const prompt2 = "audioFiles/prompts/id_emw.ogg"
    const prompt3 = "audioFiles/prompts/id_jkl.ogg"

    this.app = app

    this.singleAudio = new AudioNode(prompt1, 0, false)
    this.singleAudio.setCenterAudio();

    this.overlappingAudio = new TrialDemo(prompt1, prompt2, prompt3, 0)

    this.spreadOutAudio = new TrialDemo(prompt1, prompt2, prompt3, 90)
  }

  stopAll() {
    this.singleAudio.stopAudio()
    this.overlappingAudio.stopAll()
    this.spreadOutAudio.stopAll()
  }

  playSingleAudio() {
    this.singleAudio.playAudio()
  }

  playOverlappingAudio() {
    this.overlappingAudio.playAll()
  }

  playSpreadOutAudio() {
    this.spreadOutAudio.playAll()
  }
}

class TrialDemo {
  constructor(
    prompt1File,
    prompt2File,
    prompt3File,
    angle
  ) {
    this.centerFile = prompt1File
    this.leftFile = prompt2File
    this.rightFile = prompt3File
    this.angle = angle

    this.centerAudio = new AudioNode(this.centerFile, this.angle, false)
    this.centerAudio.setCenterAudio()

    this.leftAudio = new AudioNode(this.leftFile, this.angle, false)
    this.leftAudio.setLeftAudio()

    this.rightAudio = new AudioNode(this.rightFile, this.angle, false)
    this.rightAudio.setRightAudio()
  }

  playAll() {
    this.centerAudio.playAudio()
    this.leftAudio.playAudio()
    this.rightAudio.playAudio()
  }

  stopAll() {
    this.centerAudio.stopAudio()
    this.leftAudio.stopAudio()
    this.rightAudio.stopAudio()
  }
}

class Trial {
  constructor(
    trialID,
    targetFile,
    distLFile,
    distRFile,
    promptFile,
    talkerId,
    angle,
    timeout,
    MCPrompt,
    MCChoices,
    MCCorrect,
    app
  ) {
    // setting instance variables
    this.trialID = trialID;
    this.targetFile = targetFile;
    this.distLFile = distLFile;
    this.distRFile = distRFile;
    this.promptFile = promptFile;
    this.talkerId = talkerId;
    this.angle = angle;
    this.timeout = timeout * 1000;
    this.MCPrompt = MCPrompt;
    this.MCChoices = MCChoices;
    this.MCCorrect = MCCorrect,
    this.app = app;

    // set up prompt audio
    this.promptNode = new AudioNode(promptFile, 0, false);
    this.promptNode.setCenterAudio()

    // setup target audio
    this.targetNode = new AudioNode(targetFile, angle, false)
    this.targetNode.setCenterAudio()

    // setup left distractor audio
    this.distLNode = new AudioNode(distLFile, angle, true)
    this.distLNode.setLeftAudio()   

    // setup right distractor audio
    this.distRNode = new AudioNode(distRFile, angle, true)
    this.distRNode.setRightAudio()

    this.trialTimeSinceExperimentStarted = -1;

    this.stressText = "How hard was it to track the target voice?";
    this.efReponse = null;
    this.efStartTime = -1;
    this.efResponseTime = -1;
    this.efTimeSinceExpStarted = -1;

    this.MCResponse = null;
    this.MCStartTime = -1;
    this.MCResponseTime = -1;
    this.MCTimeSinceExpStarted = -1;
  }

  startTrial() {
    //do the first action-- probably displaying the fixation cross, and playing the promptID
    this.playPrompt();

    // init certain data in app
    this.app.mcPrompt = this.MCPrompt;
    this.app.mcChoices = this.MCChoices;
    //then set the timeout for the NEXT action (playing the trial audio proper)
  }

  playPrompt() {
    this.promptNode.playAudio();

    //when should I disconnect...?
    setTimeout(() => {
      this.stopPrompt();
    }, 2500);
  }

  stopPrompt() {
    this.promptNode.stopAudio();
    this.playTrial();
  }

  playTrial() {
    this.app.substate = "AUDIO";

    this.targetNode.playAudio()
    this.distLNode.playAudio()
    this.distRNode.playAudio()

    setTimeout(() => {
      this.stopAudio();
      //but ALSO for "advance to effortPrompt"
      this.efStartTime = new Date().getTime();
      this.app.substate = "EF";
    }, this.timeout);
  }

  stopAudio() {
    this.targetNode.stopAudio();
    this.distLNode.stopAudio();
    this.distRNode.stopAudio();
  }

  stopAll() {
    this.promptAudio.pause();
    this.promptAudio.currentTime = 0;
    this.stopAudio()
  }

  logTrial() {
    let log = [
      getDateLabel(),
      this.app.UID, 
      this.app.normal,
      this.app.hearing_vision,
      this.app.languages,
      this.app.age,
      this.app.gender_identity,
      this.app.race,
      this.trialTimeSinceExperimentStarted, 
      this.angle,
      this.talkerId, 
      this.targetFile, 
      this.distLFile, 
      this.distRFile, 
      this.efReponse,
      this.efResponseTime, 
      this.efTimeSinceExpStarted,
      this.MCResponse,
      this.MCResponse === this.MCCorrect,
      this.MCCorrect,
      this.MCResponseTime,
      this.MCTimeSinceExpStarted
    ]
    this.app.log.push(log)
    window.localStorage.setItem("log", JSON.stringify(this.app.log));
  }
}

function getDateLabel() {
  let date = new Date();
  let dateLabel =
    date.getFullYear() +
    "-" +
    (date.getMonth() + 1) +
    "-" +
    date.getDate() +
    "-" +
    date.getHours() +
    "-" +
    date.getMinutes() +
    "-" +
    date.getSeconds() +
    "-" + 
    date.getMilliseconds();
  return dateLabel
}

app = new Vue({
  el: "#app",
  startTime: -1,
  data: {
    state: "WELCOME",
    substate: "",
    trial_id: 0,
    keyPressAvailable: false,
    startExperiment: false,
    trials: [],
    demos: null,
    current_trial: null,
    UID: "",
    languages: "",
    age: null,
    gender_identity: "",
    race: "",
    hearing_vision: null,
    UIDEntered: false,
    log: [],
    stimulus: "",
    mcPrompt: "",
    trialNum: 0,
    mcChoices: [],
    efAnswer: null,
    instructions: [
      "Welcome to this study.",
      "Focus on the CENTER voice.",
      "After listening for a few seconds, we'll ask you some comprehension questions.",
    ],
  },

  created() {
    this.startTime = new Date().getTime();
    
      var keys = {};
        
      window.addEventListener('keydown', (e) => { 
        keys[e.key] = true;
        if (this.keyPressAvailable && keys['j'] && keys['k'] && keys['l']) {
          this.startExperiment = true
          this.keyPressAvailable = false
        } else if (this.keyPressAvailable && keys['Control'] && keys['h'] && keys['7']) {
          this.downloadLogTsv()
        }
      });
    
      window.addEventListener('keyup', (e) => {
          keys[e.key] = false;
      });
    
  },

  mounted() {
    this.readTsv();
  },

  methods: {
    welcomeProceed() {
      this.state = "USER_INFO"
      actx.resume();
      for(t of this.trials){
        t.timeout = parseInt(t.targetNode.audio.duration * 1000)
        console.log(t.timeout)
      }
    },

    // ----- STATE TRANSITIONS ---- //
    acceptInfo() {
      this.state = "INSTRUCT";
      this.setupLog();
      console.log(this.hearing_vision)
    },

    confirmInstructions() {
      // start demo
      this.state = "DEMO"
      this.substate = "DEMO_START"
    },

    // ----- DEMOS ---- //
    startDemo() {
      this.demos = new TrialDemos()
      this.substate = "DEMO_SINGLE"
    },

    singleAudioDemo(auto) {
      this.demos.stopAll()
      this.demos.playSingleAudio()
      this.stopDemo("DEMO_OVERLAP", auto)
    },

    overlappingAudioDemo(auto) {
      this.demos.stopAll()
      this.demos.playOverlappingAudio()
      this.stopDemo("DEMO_SPREAD_OUT", auto)
    },

    spreadoutAudioDemo(auto) {
      this.demos.stopAll()
      this.demos.playSpreadOutAudio()
      this.stopDemo("DEMO_EVERYTHING", auto)
    },

    stopDemo(newSubstate, auto) {
      if (auto) this.substate = "DEMO_AUDIO"
      setTimeout(() => {
        //this.demos.stopAll();
        if (auto) this.substate = newSubstate
      }, 2500);
    },

    finishDemo() {
      this.state = "TRIAL"
      this.substate = "START_STUDY"
      this.keyPressAvailable = true
    },

    efDone() {
      let time = new Date().getTime();
      this.current_trial.efResponseTime = time - this.current_trial.efStartTime;
      this.current_trial.efTimeSinceExpStarted = time - this.startTime;
      this.current_trial.efReponse = this.efAnswer;

      this.current_trial.MCStartTime = new Date().getTime();
      this.substate = "MC";
    },

    mcDone(answer) {
      this.substate = ''
      let time = new Date().getTime();
      this.current_trial.MCResponseTime = time - this.current_trial.MCStartTime;
      this.current_trial.MCTimeSinceExpStarted = time - this.startTime;
      this.current_trial.MCResponse = answer;

      this.current_trial.logTrial();
      this.efAnswer = null
      this.nextTrial();
    },

    // ----- STARTING TRIALS ---- //

    padTrial() {
      this.substate = "PROMPT";
      setTimeout(() => {
        this.current_trial.trialTimeSinceExperimentStarted = new Date().getTime() - this.startTime;
        this.current_trial.startTrial();
      }, 1000);
    },

    nextTrial() {
      if (this.trials.length > 0) {
        this.trialNum += 1;
        this.current_trial = this.trials.shift();
        console.log(this.trials.length)
        if (this.trials.length != 0 && this.trials.length % 20 == 0) {
          this.substate = "BREAK" 
        } else {
          this.padTrial();
        }
      } else {
        this.state = "END";
        this.keyPressAvailable = true;
      }
    },

    // ----- SETTING UP LOG ---- //

    setupLog() {
      header = ["timestamp", "UID", "normal_hearing_vision", "languages", "age", "gender_indentity", "race",
      "trial_id", "trial_time_since_exp_start", "angle", 
      "target_talker_id", "target_file", "left_dist", "right_dist",  
      "ef_rate", "ef_reaction_time", "ef_time_since_exp_start", 
      "mc_choice", "mc_is_correct", "mc_correct_answer", "mc_reation_time", "mc_time_since_exp_start"]
      this.log.push(header)
      window.localStorage.setItem("log", JSON.stringify(this.log));
    },

    downloadLogTsv() {
      let fileName = getDateLabel() + "_" + this.UID + "_" + "log.tsv";
      let finalLog = JSON.parse(window.localStorage.getItem("log"));
      let tsvContent = finalLog.map(e => e.join("\t")).join("\n");
      const blob = new Blob([tsvContent], {
        type: "text/tab-separated-values"
      });
      blobURL = URL.createObjectURL(blob);
      var href = document.createElement("a");
      href.href = blobURL;
      href.download = fileName;
      href.click();
    },

    // ----- READING EXPERIMENT DEFINITION ---- //

    readTsv() {
      fetch("experiment_def.tsv")
        .then((response) => response.text())
        .then((data) => {
          this.parseTsv(data);
        });
    },

    parseTsv(data) {
      var x = data.split("\n");
      for (var i = 0; i < x.length; i++) {
        y = x[i].split("\t");
        x[i] = y;
      }
      console.log(x);
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
        angle = curr_data[6];
        duration = parseInt(curr_data[7]);
        prompt_text = curr_data[8];
        mc_correct = curr_data[9];
        mc_choices = [curr_data[9], curr_data[10], curr_data[11], curr_data[12]];

        // converting to audio files
        target_audio_file = this.getAudioFile(target_audio_num);
        prompt_audio_file = this.getPromptFile(target_audio_num);
        distL_audio_file = this.getAudioFile(distL_audio_num);
        distR_audio_file = this.getAudioFile(distR_audio_num);

        var trial = new Trial(
          trial_id,
          target_audio_file,
          distL_audio_file,
          distR_audio_file,
          prompt_audio_file,
          talker_id,
          angle,
          duration,
          prompt_text,
          this.shuffle(mc_choices),
          mc_correct,
          this
        );
        this.trials.push(trial);
      }
      // randomize trials
      this.shuffle(this.trials);
    },

    // ----- HELPER FUNCTIONS ----- //

    shuffle(array) {
      let currentIndex = array.length,
        randomIndex;

      // While there remain elements to shuffle...
      while (currentIndex != 0) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
          array[randomIndex],
          array[currentIndex],
        ];
      }

      return array;
    },

    getAudioFile(audio_num) {
      let num_string = audio_num.substring(1);
      let num_int = parseInt(num_string);

      let audio_file = "audioFiles/" + audio_num;

      if (num_int <= 20) {
        audio_file += "_jkl.ogg";
      } else if (num_int <= 40) {
        audio_file += "_alc.ogg";
      } else {
        audio_file += "_emw.ogg";
      }

      return audio_file;
    },

    getPromptFile(target_num) {
      let num_string = target_num.substring(1);
      let num_int = parseInt(num_string);

      let prompt_file = "audioFiles/prompts/";

      if (num_int <= 20) {
        prompt_file += "id_jkl.ogg";
      } else if (num_int <= 40) {
        prompt_file += "id_alc.ogg";
      } else {
        prompt_file += "id_emw.ogg";
      }

      return prompt_file;
    },
  },
});
