if (window.AudioContext === undefined) {
  console.log("Browser cannot load audio.");
  var actx = null;
} else {
  var actx = new (window.AudioContext || window.webkitAudioContext)();
  actx.listener.setOrientation(0, 1, 0, 0, 0, 1);
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
    this.promptAudio = new Audio(promptFile);
    this.promptAudio.loop = true;
    this.promptSource = actx.createMediaElementSource(this.promptAudio);

    // setup target audio
    this.targetPanner = actx.createPanner();
    this.targetPanner.panningModel = "HRTF";
    this.targetPanner.distanceModel = "linear";

    this.targetX = 10 * Math.cos((-90 * Math.PI) / 180);
    this.targetY = 10 * Math.sin((-90 * Math.PI) / 180);
    this.targetPanner.setPosition(this.targetX, this.targetY, 0);

    this.targetAudio = new Audio(targetFile);
    this.targetAudio.loop = true;
    this.targetSource = actx.createMediaElementSource(this.targetAudio);
    this.targetSource.connect(this.targetPanner);

    // setup left distractor audio
    this.distLPanner = actx.createPanner();
    this.distLPanner.panningModel = "HRTF";
    this.distLPanner.distanceModel = "linear";

    this.distLX = 10 * Math.cos(((-angle - 90) * Math.PI) / 180);
    this.distLY = 10 * Math.sin(((-angle - 90) * Math.PI) / 180);
    this.distLPanner.setPosition(this.distLX, this.distLY, 0);

    this.distLAudio = new Audio(distLFile);
    this.distLAudio.loop = true;
    this.distLSource = actx.createMediaElementSource(this.distLAudio);
    this.distLSource.connect(this.distLPanner);

    // setup right distractor audio
    this.distRPanner = actx.createPanner();
    this.distRPanner.panningModel = "HRTF";
    this.distRPanner.distanceModel = "linear";

    this.distRX = 10 * Math.cos(((angle - 90) * Math.PI) / 180);
    this.distRY = 10 * Math.sin(((angle - 90) * Math.PI) / 180);
    this.distRPanner.setPosition(this.distRX, this.distRY, 0);

    this.distRAudio = new Audio(distRFile);
    this.distRAudio.loop = true;
    this.distRSource = actx.createMediaElementSource(this.distRAudio);
    this.distRSource.connect(this.distRPanner);

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
    this.app.substate = "PROMPT";
    this.promptSource.connect(actx.destination);

    this.promptAudio.play();

    //when should I disconnect...?
    setTimeout(() => {
      this.stopPrompt();
    }, 2500);
  }

  stopPrompt() {
    this.promptAudio.pause();
    this.promptAudio.currentTime = 0;
    this.playTrial();
  }

  playTrial() {
    this.app.substate = "AUDIO";

    this.targetPanner.connect(actx.destination);
    this.distLPanner.connect(actx.destination);
    this.distRPanner.connect(actx.destination);

    this.targetAudio.play();
    this.distLAudio.play();
    this.distRAudio.play();

    setTimeout(() => {
      this.stopAudio();
      //but ALSO for "advance to effortPrompt"
      this.efStartTime = new Date().getTime();
      this.app.substate = "EF";
    }, this.timeout);
  }

  stopAudio() {
    this.targetAudio.pause();
    this.targetAudio.currentTime = 0;

    this.distLAudio.pause();
    this.distLAudio.currentTime = 0;

    this.distRAudio.pause();
    this.distRAudio.currentTime = 0;
  }

  stopAll() {
    this.promptAudio.pause();
    this.promptAudio.currentTime = 0;
    this.stopAudio()
  }

  logTrial() {
    let log = [
      getDateLabel(),
      this.trialID, 
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
    date.getMonth() +
    "-" +
    date.getDay() +
    "-" +
    date.getHours() +
    "-" +
    date.getMinutes() +
    "-" +
    date.getSeconds();
  return dateLabel
}

app = new Vue({
  el: "#app",
  startTime: -1,
  data: {
    state: "ENTER_ID",
    substate: "",
    trial_id: 0,
    trials: [],
    current_trial: null,
    UID: "",
    UIDEntered: false,
    log: [],
    stimulus: "",
    mcPrompt: "",
    trialNum: 0,
    efAnswers: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    mcChoices: [],
    instructions: [
      "Try to listen closely to the audio in each trial to come.",
      "Focus on the CENTER voice.",
      "After listening for a few seconds, we'll ask you some comprehension questions.",
    ],
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
      this.state = "INSTRUCT";
      this.setupLog();
    },

    confirmInstructions() {
      // initiate the first trial in the list
      this.state = "TRIAL";
      this.nextTrial();
    },

    efDone(answer) {
      let time = new Date().getTime();
      this.current_trial.efResponseTime = time - this.current_trial.efStartTime;
      this.current_trial.efTimeSinceExpStarted = time - this.startTime;
      this.current_trial.efReponse = answer;

      this.current_trial.MCStartTime = new Date().getTime();
      this.substate = "MC";
    },

    mcDone(answer) {
      let time = new Date().getTime();
      this.current_trial.MCResponseTime = time - this.current_trial.MCStartTime;
      this.current_trial.MCTimeSinceExpStarted = time - this.startTime;
      this.current_trial.MCResponse = answer;

      this.current_trial.logTrial();
      this.nextTrial();
    },

    logScreen() {
      this.state = "LOG"
    },

    // ----- STARTING TRIALS ---- //

    nextTrial() {
      if (this.trials.length > 59) {
        this.trialNum += 1;
        this.current_trial = this.trials.shift();
        console.log(this.current_trial.targetFile);
        this.current_trial.trialTimeSinceExperimentStarted = new Date().getTime() - this.startTime;
        this.current_trial.startTrial();
      } else {
        this.state = "END";
      }
    },

    // ----- SETTING UP LOG ---- //

    setupLog() {
      header = ["timestamp", "trial_id", "trial_time_since_exp_start", "angle", 
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
        angle = curr_data[5];
        duration = parseInt(curr_data[6]);
        prompt_text = curr_data[7];
        mc_correct = curr_data[8];
        mc_choices = [curr_data[8], curr_data[9], curr_data[10], curr_data[11]];

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
