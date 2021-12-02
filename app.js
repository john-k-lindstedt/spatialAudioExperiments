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
    constructor(targetFile,distLFile,distRFile,angle,timeout,MCPrompt,MCChoices,MCCorrect){
      
      // setup prompt audio
      this.promptText = "+"

      //this.promptAudio = new Audio(promptFile)
      //this.promptSource = actx.createMediaElementSource(this.promptAudio)

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

      this.stressResponse = null


      //prep multiple choice question
      this.MCText = MCPrompt
      this.MCChoices = MCChoices
      this.MCCorrect = MCCorrect

      this.MCResponse = null
      this.MCResponseTime = -1
      this.MCCorrect = null
    }
    
    startTrial(){
      //do the first action-- probably displaying the fixation cross, and playing the promptID
      //then set the timeout for the NEXT action (playing the trial audio proper)
    }
    
    playPrompt(){
      this.promptSource.connect(actx.destination)
      this.promptAudio.play()

      //when should I disconnect...?
    }

    playTrial(){
      this.targetPanner.connect(actx.destination)
      this.distLPanner.connect(actx.destination)
      this.distRPanner.connect(actx.destination)

      this.targetAudio.play()
      this.distLAudio.play()
      this.distRAudio.play()
      
      //after starting, set a timeout for "stopAll()"
      

      //  but ALSO for "advance to effortPrompt"
    }
    
    stopAll(){
      //this.promptAudio.pause()
      //this.promptAudio.currentTime = 0

      this.targetAudio.pause()
      this.targetAudio.currentTime = 0

      this.distLAudio.pause()
      this.distLAudio.currentTime = 0

      this.distRAudio.pause()
      this.distRAudio.currentTime = 0
    }

  }

  var audio_files = [
    "file1.ogg",
    "file2.ogg"
  ]

  var trials = [

  ]

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
      log: [],
      stimulus: "",
      mcPrompt: "",
      saPrompt: "",
      efPrompt: "How would you rate the difficulty of this trial?",
      efAnswers: ["0","1","2","3","4","5","6","7","8","9"],
      mcChoices: [],
      instructions: [
        "Try to listen closely to the audio in each trial to come.",
        "Focus on the CENTER voice.",
        "After listening for a few seconds, we'll ask you some comprehension questions."
      ]
    },
    created() {
      this.listenerSetup()
      this.startTime = new Date().getTime();
    },
    mounted() {
      //this.loadAudio();
      this.readJson();
    },
    methods: {
      listenerSetup(){
        window.addEventListener('keydown', (e) => {
          this.logEvent("keypress",e.key)
          if (e.key == 'ArrowLeft') {
            this.decrement();
          }
          if (e.key == 'ArrowRight') {
            this.increment();
          }
        });
      },

      acceptID(){
        this.state = "INSTRUCT"
      },

      efAssessment() {
        this.current_trial.stopAll()
        this.substate = "EF"
      },

      efDone(answer) {
        this.mcPrompt = this.current_trial.MCText
        this.mcChoices = this.current_trial.MCChoices
        this.logEvent("Effort assessment", answer)
        this.substate = "MC"
      },

      mcDone(answer) {
        this.logEvent("Effort assessment", answer)
        this.initializeAudio()
      },

      confirmInstructions(){
        // initiate the first trial in the list 
        this.initializeAudio()
      },

      initializeAudio(){    
        if (this.trials.length > 0) {
            this.state = "TRIAL"
            this.substate = "AUDIO"
            this.current_trial = this.trials.shift()
            this.current_trial.playTrial()
            setTimeout(() => { this.efAssessment(); }, 3000);
        } else {
            this.state = "END"
        }  
      },
      
      setupLog(){

      },
      
      logEvent(type, value){
        console.log(type,value)

        //also need to open up a local file to write this stuff to 
          //depending on how often the system lets us write / keep open file 
          //we may need to save a bunch of files (e.g., one per trial)

        // const data = JSON.stringify({type, value})
        // const blob = new Blob([data], {type: 'text/plain'})
        // const e = document.createEvent('Event');
        // a = document.createElement('a');
        // a.download = "test.json";
        // a.href = window.URL.createObjectURL(blob);
        // a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');

        // a.addEventListener('build', function (e) {
        //     // e.target matches elem

        //   }, false);
        // a.Event('click', true, true);
        // a.dispatchEvent(e);
      },

      readJson(){
        fetch('./trials.json')
          .then(response => response.json())
          .then(data => this.buildTrials(data));
      },

      buildTrials(data){
        //read the trial definitions from a log using JSON 
        //build each one of the Trial() objects based on those logs
        var trial; 
        for (i = 0; i < data.length; i++) {
          console.log(data[i])
          curr_data = data[i];

          targetFile = curr_data["targetFile"];
          distLFile = curr_data["distLFile"];
          distRFile = curr_data["distRFile"];
          angle = curr_data["angle"];
          timeout = curr_data["timeout"];
          mcPrompt = curr_data["mcPrompt"];
          mcChoices = curr_data["mcChoices"];
          mcCorrect = curr_data["mcCorrect"];

          trial = new Trial(targetFile, distLFile, distRFile, angle, timeout, mcPrompt, mcChoices, mcCorrect)
          this.trials.push(trial)
        }
    
      }
    }

  })
