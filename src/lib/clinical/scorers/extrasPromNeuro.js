import { todayLocal } from '../../localDate.js';

const NOTES_MAX = 4000;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const textField = (key, label, required = false) => ({ key, label, type: 'textarea', required, maxLength: NOTES_MAX });

export const PROM_NEURO_K10_QUESTIONS = deepFreeze([
  "Tired out for no good reason",
  "Nervous",
  "So nervous that nothing could calm you down",
  "Hopeless",
  "Restless or fidgety",
  "So restless that you could not sit still",
  "Depressed",
  "That everything was an effort",
  "So sad that nothing could cheer you up",
  "Worthless",
]);

export const PROM_NEURO_K10_OPTIONS = deepFreeze([
  { label: "None of the time", value: 1 },
  { label: "A little of the time", value: 2 },
  { label: "Some of the time", value: 3 },
  { label: "Most of the time", value: 4 },
  { label: "All of the time", value: 5 },
]);

export const PROM_NEURO_FSS_QUESTIONS = deepFreeze([
  "My motivation is lower when I am fatigued.",
  "Exercise brings on my fatigue.",
  "I am easily fatigued.",
  "Fatigue interferes with my physical functioning.",
  "Fatigue causes frequent problems for me.",
  "My fatigue prevents sustained physical functioning.",
  "Fatigue interferes with carrying out certain duties and responsibilities.",
  "Fatigue is among my three most disabling symptoms.",
  "Fatigue interferes with my work, family, or social life."
]);

export const PROM_NEURO_LEFS_LEFS_ACTIVITIES = deepFreeze([
  "Any of your usual work, housework, or school activities",
  "Your usual hobbies, recreational or sporting activities",
  "Getting into or out of the bath",
  "Walking between rooms",
  "Putting on your shoes or socks",
  "Squatting",
  "Lifting an object, like a bag of groceries from the floor",
  "Performing light activities around your home",
  "Performing heavy activities around your home",
  "Getting into or out of a car",
  "Walking 2 blocks",
  "Walking a mile",
  "Going up or down 10 stairs (about 1 flight of stairs)",
  "Standing for 1 hour",
  "Sitting for 1 hour",
  "Running on even ground",
  "Running on uneven ground",
  "Making sharp turns while running fast",
  "Hopping",
  "Rolling over in bed"
]);

export const PROM_NEURO_PHQ9_QUESTIONS = deepFreeze([
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself, or that you are a failure, or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead or of hurting yourself in some way",
]);

export const PROM_NEURO_PHQ9_OPTIONS = deepFreeze(["Not at all", "Several days", "More than half the days", "Nearly every day"]);

export const PROM_NEURO_GAD7_QUESTIONS = deepFreeze([
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it's hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid, as if something awful might happen",
]);

export const PROM_NEURO_GAD7_OPTIONS = deepFreeze(["Not at all", "Several days", "More than half the days", "Nearly every day"]);

export const PROM_NEURO_ODI_ODI_SECTIONS = deepFreeze([
  {
    name: "Pain Intensity",
    options: [
      "I have no pain at the moment",
      "The pain is very mild at the moment",
      "The pain is moderate at the moment",
      "The pain is fairly severe at the moment",
      "The pain is very severe at the moment",
      "The pain is the worst imaginable at the moment"
    ]
  },
  {
    name: "Personal Care",
    options: [
      "I can look after myself normally without causing extra pain",
      "I can look after myself normally but it causes extra pain",
      "It is painful to look after myself and I am slow and careful",
      "I need some help but manage most of my personal care",
      "I need help every day in most aspects of self-care",
      "I do not get dressed, wash with difficulty, and stay in bed"
    ]
  },
  {
    name: "Lifting",
    options: [
      "I can lift heavy weights without extra pain",
      "I can lift heavy weights but it gives extra pain",
      "Pain prevents me from lifting heavy weights off the floor, but I can manage if they are conveniently positioned",
      "Pain prevents me from lifting heavy weights, but I can manage light to medium weights if they are conveniently positioned",
      "I can lift only very light weights",
      "I cannot lift or carry anything at all"
    ]
  },
  {
    name: "Walking",
    options: [
      "Pain does not prevent me walking any distance",
      "Pain prevents me walking more than 1 mile",
      "Pain prevents me walking more than ½ mile",
      "Pain prevents me walking more than ¼ mile",
      "I can only walk using a stick or crutches",
      "I am in bed most of the time and have to crawl to the toilet"
    ]
  },
  {
    name: "Sitting",
    options: [
      "I can sit in any chair as long as I like",
      "I can sit in my favorite chair as long as I like",
      "Pain prevents me sitting more than 1 hour",
      "Pain prevents me from sitting more than ½ hour",
      "Pain prevents me from sitting more than 10 minutes",
      "Pain prevents me from sitting at all"
    ]
  },
  {
    name: "Standing",
    options: [
      "I can stand as long as I want without extra pain",
      "I can stand as long as I want but it gives me extra pain",
      "Pain prevents me from standing for more than 1 hour",
      "Pain prevents me from standing for more than ½ hour",
      "Pain prevents me from standing for more than 10 minutes",
      "Pain prevents me from standing at all"
    ]
  },
  {
    name: "Sleeping",
    options: [
      "My sleep is never disturbed by pain",
      "My sleep is occasionally disturbed by pain",
      "Because of pain I have less than 6 hours sleep",
      "Because of pain I have less than 4 hours sleep",
      "Because of pain I have less than 2 hours sleep",
      "Pain prevents me from sleeping at all"
    ]
  },
  {
    name: "Sex Life",
    options: [
      "My sex life is normal and causes no extra pain",
      "My sex life is normal but causes some extra pain",
      "My sex life is nearly normal but is very painful",
      "My sex life is severely restricted by pain",
      "My sex life is nearly absent because of pain",
      "Pain prevents any sex life at all"
    ]
  },
  {
    name: "Social Life",
    options: [
      "My social life is normal and gives me no extra pain",
      "My social life is normal but increases the degree of pain",
      "Pain has no significant effect on my social life apart from limiting more energetic interests",
      "Pain has restricted my social life and I do not go out as often",
      "Pain has restricted my social life to my home",
      "I have no social life because of pain"
    ]
  },
  {
    name: "Traveling",
    options: [
      "I can travel anywhere without pain",
      "I can travel anywhere but it gives me extra pain",
      "Pain is bad but I manage journeys over two hours",
      "Pain restricts me to journeys of less than one hour",
      "Pain restricts me to short necessary journeys under 30 minutes",
      "Pain prevents me from traveling except to receive treatment"
    ]
  }
]);

export const PROM_NEURO_FMA_SECTIONS = deepFreeze([
  {
    key: "upper_extremity",
    label: "Upper Extremity Motor Function",
    maxScore: 66,
    items: [
      "Shoulder retraction", "Shoulder elevation", "Shoulder abduction (90°)",
      "Shoulder external rotation", "Elbow flexion", "Elbow supination/pronation",
      "Wrist stability (elbow 90°)", "Wrist flexion/extension (elbow 90°)",
      "Wrist stability (elbow 0°)", "Wrist flexion/extension (elbow 0°)",
      "Wrist circumduction", "Finger mass flexion", "Finger mass extension",
      "Hook grasp", "Lateral prehension", "Palmar prehension",
      "Cylindrical grasp", "Spherical grasp", "Finger individual movements",
      "Wrist flexion (elbow extended)", "Wrist extension (elbow extended)",
      "Elbow flexion (full ROM)", "Elbow extension (full ROM)",
    ],
  },
  {
    key: "lower_extremity",
    label: "Lower Extremity Motor Function",
    maxScore: 34,
    items: [
      "Hip flexion (supine)", "Knee flexion (supine)", "Ankle dorsiflexion (supine)",
      "Hip flexion (sitting)", "Knee extension (sitting)", "Ankle dorsiflexion (sitting)",
      "Hip abduction (sitting)", "Hip internal/external rotation (sitting)",
      "Heel to shin (supine)", "Knee flexion (prone)", "Ankle dorsiflexion (prone)",
      "Hip extension (prone)", "Standing - hip abduction", "Standing - hip/knee flexion",
      "Standing - ankle dorsiflexion", "Tremor", "Dysmetria", "Speed",
    ],
  },
  {
    key: "balance",
    label: "Balance",
    maxScore: 14,
    items: [
      "Sitting without support", "Protective reaction (non-affected side)",
      "Protective reaction (affected side)", "Standing with support",
      "Standing without support", "Standing on non-affected leg",
      "Standing on affected leg",
    ],
  },
  {
    key: "sensation",
    label: "Sensation",
    maxScore: 24,
    items: [
      "Light touch - upper arm", "Light touch - forearm", "Light touch - palm",
      "Light touch - thumb", "Position sense - shoulder", "Position sense - elbow",
      "Position sense - wrist", "Position sense - thumb",
      "Light touch - thigh", "Light touch - leg", "Light touch - dorsum of foot",
      "Position sense - hip", "Position sense - knee", "Position sense - ankle",
      "Position sense - toe",
    ],
  },
  {
    key: "joint_rom",
    label: "Joint ROM / Pain",
    maxScore: 44,
    items: [
      "Shoulder ROM", "Shoulder pain", "Elbow ROM", "Elbow pain",
      "Forearm ROM", "Forearm pain", "Wrist ROM", "Wrist pain",
      "Finger ROM", "Finger pain", "Hip ROM", "Hip pain",
      "Knee ROM", "Knee pain", "Ankle ROM", "Ankle pain",
      "Foot ROM", "Foot pain", "Subtalar ROM", "Subtalar pain",
      "Knee extension ROM", "Knee extension pain",
    ],
  },
]);

export const PROM_NEURO_SARC_F_QUESTIONS = deepFreeze([
  {
    id: 1,
    domain: "Strength",
    icon: "💪",
    script: "How much difficulty do you have lifting and carrying 10 pounds (approximately 4.5 kg)?",
    example: "e.g. a heavy shopping bag or a gallon of milk",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "Some difficulty" },
      { value: 2, label: "A lot of difficulty or unable" },
    ],
  },
  {
    id: 2,
    domain: "Assistance Walking",
    icon: "🚶",
    script: "How much difficulty do you have walking across a room?",
    example: "e.g. walking from one side of a room to the other without stopping",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "Some difficulty" },
      { value: 2, label: "A lot of difficulty, use aids, or unable" },
    ],
  },
  {
    id: 3,
    domain: "Rise from Chair",
    icon: "🪑",
    script: "How much difficulty do you have transferring from a chair or bed?",
    example: "e.g. rising from a chair without using the armrests",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "Some difficulty" },
      { value: 2, label: "A lot of difficulty or requires assistance" },
    ],
  },
  {
    id: 4,
    domain: "Climb Stairs",
    icon: "🪜",
    script: "How much difficulty do you have climbing a flight of 10 stairs?",
    example: "e.g. climbing one full flight of stairs indoors",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "Some difficulty" },
      { value: 2, label: "A lot of difficulty or unable" },
    ],
  },
  {
    id: 5,
    domain: "Falls",
    icon: "⚠",
    script: "How many times have you fallen in the last year?",
    example: "Include any unplanned descent to the ground, regardless of injury",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "1–3 falls" },
      { value: 2, label: "4 or more falls" },
    ],
  },
]);

export const PROM_NEURO_NDI_SECTIONS = deepFreeze([
  {
    title: "Section 1 – Pain Intensity",
    options: [
      { value: 0, label: "I have no pain at the moment" },
      { value: 1, label: "The pain is very mild at the moment" },
      { value: 2, label: "The pain is moderate at the moment" },
      { value: 3, label: "The pain is fairly severe at the moment" },
      { value: 4, label: "The pain is very severe at the moment" },
      { value: 5, label: "The pain is the worst imaginable at the moment" },
    ],
  },
  {
    title: "Section 2 – Personal Care (Washing, Dressing, etc.)",
    options: [
      { value: 0, label: "I can look after myself normally without causing extra pain" },
      { value: 1, label: "I can look after myself normally but it causes extra pain" },
      { value: 2, label: "It is painful to look after myself and I am slow and careful" },
      { value: 3, label: "I need some help but manage most of my personal care" },
      { value: 4, label: "I need help every day in most aspects of self care" },
      { value: 5, label: "I do not get dressed, I wash with difficulty and stay in bed" },
    ],
  },
  {
    title: "Section 3 – Lifting",
    options: [
      { value: 0, label: "I can lift heavy weights without extra pain" },
      { value: 1, label: "I can lift heavy weights but it gives extra pain" },
      { value: 2, label: "Pain prevents me lifting heavy weights off the floor, but I can manage if they are conveniently placed, e.g. on a table" },
      { value: 3, label: "Pain prevents me lifting heavy weights but I can manage light to medium weights if conveniently positioned" },
      { value: 4, label: "I can lift very light weights" },
      { value: 5, label: "I cannot lift or carry anything at all" },
    ],
  },
  {
    title: "Section 4 – Reading",
    options: [
      { value: 0, label: "I can read as much as I want to with no pain in my neck" },
      { value: 1, label: "I can read as much as I want to with slight pain in my neck" },
      { value: 2, label: "I can read as much as I want to with moderate pain in my neck" },
      { value: 3, label: "I cannot read as much as I want because of moderate pain in my neck" },
      { value: 4, label: "I can hardly read at all because of severe pain in my neck" },
      { value: 5, label: "I cannot read at all" },
    ],
  },
  {
    title: "Section 5 – Headaches",
    options: [
      { value: 0, label: "I have no headaches at all" },
      { value: 1, label: "I have slight headaches which come infrequently" },
      { value: 2, label: "I have moderate headaches which come infrequently" },
      { value: 3, label: "I have moderate headaches which come frequently" },
      { value: 4, label: "I have severe headaches which come frequently" },
      { value: 5, label: "I have headaches almost all the time" },
    ],
  },
  {
    title: "Section 6 – Concentration",
    options: [
      { value: 0, label: "I can concentrate fully when I want to with no difficulty" },
      { value: 1, label: "I can concentrate fully when I want to with slight difficulty" },
      { value: 2, label: "I have a fair degree of difficulty in concentrating when I want to" },
      { value: 3, label: "I have a lot of difficulty in concentrating when I want to" },
      { value: 4, label: "I have a great deal of difficulty in concentrating when I want to" },
      { value: 5, label: "I cannot concentrate at all" },
    ],
  },
  {
    title: "Section 7 – Work",
    options: [
      { value: 0, label: "I can do as much work as I want to" },
      { value: 1, label: "I can only do my usual work but no more" },
      { value: 2, label: "I can do most of my usual work but no more" },
      { value: 3, label: "I cannot do my usual work" },
      { value: 4, label: "I can hardly do any work at all" },
      { value: 5, label: "I cannot do any work at all" },
    ],
  },
  {
    title: "Section 8 – Driving",
    options: [
      { value: 0, label: "I can drive my car without any neck pain" },
      { value: 1, label: "I can drive my car as long as I want with slight pain in my neck" },
      { value: 2, label: "I can drive my car as long as I want with moderate pain in my neck" },
      { value: 3, label: "I cannot drive my car as long as I want because of moderate pain" },
      { value: 4, label: "I can hardly drive at all because of severe pain" },
      { value: 5, label: "I cannot drive my car at all" },
    ],
  },
  {
    title: "Section 9 – Sleeping",
    options: [
      { value: 0, label: "I have no trouble sleeping" },
      { value: 1, label: "My sleep is slightly disturbed (less than 1 hour sleepless)" },
      { value: 2, label: "My sleep is mildly disturbed (1–2 hours sleepless)" },
      { value: 3, label: "My sleep is moderately disturbed (2–3 hours sleepless)" },
      { value: 4, label: "My sleep is greatly disturbed (3–5 hours sleepless)" },
      { value: 5, label: "My sleep is completely disturbed (5–7 hours sleepless)" },
    ],
  },
  {
    title: "Section 10 – Recreation",
    options: [
      { value: 0, label: "I am able to engage in all my recreational activities with no neck pain" },
      { value: 1, label: "I am able to engage in all my recreational activities with some pain in my neck" },
      { value: 2, label: "I am able to engage in most but not all of my recreational activities because of pain in my neck" },
      { value: 3, label: "I am able to engage in only a few of my usual recreational activities because of pain" },
      { value: 4, label: "I can hardly engage in any recreational activities because of pain" },
      { value: 5, label: "I cannot engage in any recreational activities at all" },
    ],
  },
]);

export const PROM_NEURO_HOOS_HOOS_SUBSCALES = deepFreeze([
  { name: "Symptoms", label: "Symptoms", items: ["S1", "S2", "S3", "S4", "S5"] },
  { name: "Pain", label: "Pain", items: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"] },
  { name: "ActivitiesOfDailyLiving", label: "Activities of Daily Living", items: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12", "A13", "A14", "A15", "A16", "A17"] },
  { name: "SportAndRecreation", label: "Sport & Recreation", items: ["SP1", "SP2", "SP3", "SP4"] },
  { name: "QualityOfLife", label: "Quality of Life", items: ["Q1", "Q2", "Q3", "Q4"] },
]);

export const PROM_NEURO_HOOS_QUESTIONS = deepFreeze({
  S1: "Do you feel grinding, hear clicking or any other type of noise when your hip moves?",
  S2: "Difficulties spreading legs wide apart",
  S3: "Difficulties striding out when walking",
  S4: "In the morning: How severe is your hip stiffness?",
  S5: "After sitting, lying: How severe is your hip stiffness?",
  P1: "How often do you experience hip pain?",
  P2: "Straightening hip fully",
  P3: "Bending hip fully",
  P4: "Walking on flat surface",
  P5: "Going up or down stairs",
  P6: "At night while in bed",
  P7: "Sitting or lying",
  P8: "Standing upright",
  P9: "Walking on hard surface",
  P10: "Getting in/out of car or getting in/out of bath",
  A1: "Descending stairs", A2: "Ascending stairs", A3: "Rising from sitting",
  A4: "Standing", A5: "Bending to floor/pick up an object", A6: "Walking on flat surface",
  A7: "Getting in/out of car", A8: "Going shopping", A9: "Putting on socks/stockings",
  A10: "Rising from bed", A11: "Taking off socks/stockings", A12: "Lying in bed",
  A13: "Getting in/out of bath", A14: "Sitting", A15: "Getting on/off toilet",
  A16: "Heavy domestic duties", A17: "Light domestic duties",
  SP1: "Squatting", SP2: "Running", SP3: "Twisting/pivoting on your injured hip", SP4: "Walking on uneven surface",
  Q1: "How often are you aware of your hip problem?",
  Q2: "Have you modified your life style to avoid activities potentially damaging to your hip?",
  Q3: "How much are you troubled with lack of confidence in your hip?",
  Q4: "In general, how much difficulty do you have with your hip?"
});

export const PROM_NEURO_HOOS_SCORELABELS = deepFreeze(["None", "Mild", "Moderate", "Severe", "Extreme"]);

export const PROM_NEURO_KOOS_SECTIONS = deepFreeze({
  symptoms: {
    name: "Symptoms",
    instruction: "What symptoms have you had in your knee the last week?",
    questions: [
      { id: "Sy1", text: "Do you have swelling in your knee?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "Sy2", text: "Do you feel grinding, hear clicking or any other type of noise when your knee moves?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "Sy3", text: "Does your knee catch or hang up when moving?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "Sy4", text: "Can you straighten your knee fully?", options: ["Always", "Often", "Sometimes", "Rarely", "Never"] },
      { id: "Sy5", text: "Can you bend your knee fully?", options: ["Always", "Often", "Sometimes", "Rarely", "Never"] },
      { id: "Sy6", text: "How severe is your knee stiffness after first wakening in the morning?", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sy7", text: "How severe is your knee stiffness after sitting, lying or resting later in the day?", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
  pain: {
    name: "Pain",
    instruction: "What degree of pain have you experienced the last week when performing the following activities?",
    questions: [
      { id: "P1", text: "How often do you experience knee pain?", options: ["Never", "Monthly", "Weekly", "Daily", "Always"] },
      { id: "P2", text: "Twisting/pivoting on your knee", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P3", text: "Straightening knee fully", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P4", text: "Bending knee fully", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P5", text: "Walking on flat surface", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P6", text: "Going up or down stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P7", text: "At night while in bed", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P8", text: "Sitting or lying", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P9", text: "Standing upright", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
  adl: {
    name: "Daily Living",
    instruction: "What difficulty have you experienced the last week doing the following activities of daily living?",
    questions: [
      { id: "A1", text: "Descending stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A2", text: "Ascending stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A3", text: "Rising from sitting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A4", text: "Standing", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A5", text: "Bending to floor/picking up an object", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A6", text: "Walking on flat surface", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A7", text: "Getting in/out of car", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A8", text: "Going shopping", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A9", text: "Putting on socks/stockings", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A10", text: "Rising from bed", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A11", text: "Taking off socks/stockings", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A12", text: "Lying in bed (turning over, maintaining knee position)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A13", text: "Getting in/out of bath", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A14", text: "Sitting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A15", text: "Getting on/off toilet", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A16", text: "Heavy domestic duties (shovelling, scrubbing floors, etc.)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A17", text: "Light domestic duties (cooking, dusting, etc.)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
  sport: {
    name: "Sport & Recreation",
    instruction: "What difficulty have you experienced the last week during the following activities?",
    questions: [
      { id: "Sp1", text: "Squatting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp2", text: "Running", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp3", text: "Jumping", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp4", text: "Turning/twisting on your injured knee", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp5", text: "Kneeling", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
  qol: {
    name: "Quality of Life",
    instruction: "The following questions are related to your quality of life.",
    questions: [
      { id: "Q1", text: "How often are you aware of your knee problem?", options: ["Never", "Monthly", "Weekly", "Daily", "Always"] },
      { id: "Q2", text: "Have you modified your lifestyle to avoid potentially damaging activities to your knee?", options: ["Not at all", "Mildly", "Moderately", "Severely", "Totally"] },
      { id: "Q3", text: "How much are you troubled with lack of confidence in your knee?", options: ["Not at all", "Mildly", "Moderately", "Severely", "Extremely"] },
      { id: "Q4", text: "In general, how much difficulty do you have with your knee?", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
});

export const PROM_NEURO_FIQR_FUNCTION_ITEMS = deepFreeze([
  "Brush or comb your hair",
  "Walk continuously for 20 minutes",
  "Prepare a homemade meal",
  "Vacuum, scrub or sweep floors",
  "Lift and carry a bag full of groceries",
  "Climb one flight of stairs",
  "Change bed sheets",
  "Sit in a chair for 45 minutes",
  "Go shopping for groceries",
]);

export const PROM_NEURO_FIQR_OVERALL_ITEMS = deepFreeze([
  "Fibromyalgia prevented me from accomplishing goals for the week",
  "I was completely overwhelmed by my fibromyalgia symptoms",
]);

export const PROM_NEURO_FIQR_SYMPTOM_ITEMS = deepFreeze([
  "Pain",
  "Energy",
  "Stiffness",
  "Sleep quality",
  "Depression",
  "Anxiety",
  "Memory problems",
  "Tenderness",
  "Balance problems",
  "Environmental sensitivity (light, noise, cold, heat)",
]);

export const PROM_NEURO_WPI_WPI_REGIONS = deepFreeze([
  "Left jaw", "Right jaw",
  "Left shoulder", "Right shoulder",
  "Left upper arm", "Right upper arm",
  "Left lower arm", "Right lower arm",
  "Left hip (buttock/trochanter)", "Right hip (buttock/trochanter)",
  "Left upper leg", "Right upper leg",
  "Left lower leg", "Right lower leg",
  "Left chest", "Right chest",
  "Upper back", "Lower back",
  "Abdomen", "Neck",
]);

export const PROM_NEURO_WPI_SSS_ITEMS = deepFreeze([
  { key: "fatigue", label: "Fatigue" },
  { key: "waking_unrefreshed", label: "Waking unrefreshed" },
  { key: "cognitive_symptoms", label: "Cognitive symptoms" },
]);

export const PROM_NEURO_WPI_SOMATIC_OPTIONS = deepFreeze([
  { value: 0, label: "0 — No symptoms" },
  { value: 1, label: "1 — Few symptoms, generally mild" },
  { value: 2, label: "2 — Moderate number of symptoms" },
  { value: 3, label: "3 — Many symptoms, severe" },
]);

export const PROM_NEURO_PCS_PCS_ITEMS = deepFreeze([
  { text: "I worry all the time about whether the pain will end.", subscale: "Helplessness" },
  { text: "I feel I can't go on.", subscale: "Helplessness" },
  { text: "It's terrible and I think it's never going to get any better.", subscale: "Helplessness" },
  { text: "It's awful and I feel that it overwhelms me.", subscale: "Helplessness" },
  { text: "I feel I can't stand it anymore.", subscale: "Helplessness" },
  { text: "I become afraid that the pain will get worse.", subscale: "Magnification" },
  { text: "I keep thinking of other painful events.", subscale: "Magnification" },
  { text: "I anxiously want the pain to go away.", subscale: "Rumination" },
  { text: "I can't seem to keep it out of my mind.", subscale: "Rumination" },
  { text: "I keep thinking about how much it hurts.", subscale: "Rumination" },
  { text: "I keep thinking about how badly I want the pain to stop.", subscale: "Rumination" },
  { text: "There's nothing I can do to reduce the intensity of the pain.", subscale: "Helplessness" },
  { text: "I wonder whether something serious may happen.", subscale: "Magnification" },
]);

export const PROM_NEURO_PCS_SCORE_LABELS = deepFreeze(["0 – Not at all", "1 – Slight", "2 – Moderate", "3 – Great degree", "4 – All the time"]);

export const PROM_NEURO_DSQ2_SYMPTOM_DOMAINS = deepFreeze([
  {
    domain: "Post-Exertional Malaise (PEM)",
    items: [
      "Next-day soreness or fatigue after non-strenuous, every-day activities",
      "Mentally tired after the slightest effort",
      "Minimum exercise makes you physically tired",
      "Physically drained or sick after mild activity",
      "Dead, heavy feeling after starting to exercise",
    ],
  },
  {
    domain: "Sleep Problems",
    items: [
      "Unrefreshing sleep or waking up feeling tired",
      "Need to nap daily",
      "Difficulty falling asleep",
      "Difficulty staying asleep",
      "Sleeping too much (hypersomnia)",
    ],
  },
  {
    domain: "Pain",
    items: [
      "Muscle pain",
      "Joint pain without swelling or redness",
      "Eye pain",
      "Chest pain",
      "Headaches",
    ],
  },
  {
    domain: "Neurocognitive Symptoms",
    items: [
      "Difficulty paying attention for a long period of time",
      "Problems remembering things",
      "Difficulty finding the right word",
      "Difficulty understanding things",
      "Only able to focus on one thing at a time",
      "Slowness of thought",
      "Absent-mindedness or forgetfulness",
    ],
  },
  {
    domain: "Autonomic Manifestations",
    items: [
      "Feeling unsteady on your feet",
      "Shortness of breath or difficulty breathing",
      "Dizziness or fainting",
      "Irregular heartbeat",
      "Nausea",
      "Bladder problems",
      "Irritable bowel symptoms",
    ],
  },
  {
    domain: "Neuroendocrine Manifestations",
    items: [
      "Feeling cold when others are not",
      "Hot or cold spells",
      "Chills or shivers",
      "Night sweats",
      "Feeling feverish",
      "Intolerance of extreme temperatures",
      "Marked weight change (unexplained)",
      "Loss of appetite or increased appetite",
    ],
  },
  {
    domain: "Immune Manifestations",
    items: [
      "Recurrent flu-like symptoms",
      "Sore throat",
      "Tender lymph nodes",
      "New or increased sensitivity to food",
      "New or increased sensitivity to medication",
      "New or increased sensitivity to chemicals",
      "New or increased sensitivity to noise",
      "New or increased sensitivity to light",
    ],
  },
  {
    domain: "Additional Symptoms",
    items: [
      "Muscle weakness",
      "Feeling tired throughout the day",
      "Difficulty with everyday activities due to fatigue",
      "Sensitivity to vibrations",
      "Sensitivity to odours",
      "Difficulty tolerating upright position",
      "Anxiety",
      "Depression",
      "Irritability",
      "Mood swings",
      "Feeling overwhelmed by stress",
    ],
  },
]);

export const PROM_NEURO_DSQ2_FREQ_OPTIONS = deepFreeze([
  { value: 0, label: "Never" },
  { value: 1, label: "Sometimes\n(<half the time)" },
  { value: 2, label: "About half\nthe time" },
  { value: 3, label: "Most of\nthe time" },
  { value: 4, label: "Always" },
]);

export const PROM_NEURO_DSQ2_SEV_OPTIONS = deepFreeze([
  { value: 0, label: "Symptom\nnot present" },
  { value: 1, label: "Mild" },
  { value: 2, label: "Moderate" },
  { value: 3, label: "Severe" },
  { value: 4, label: "Very severe" },
]);

export const PROM_NEURO_DSQ2_PEM_TRIGGERS = deepFreeze([
  "Minimal physical exertion",
  "Basic activities of daily living",
  "Positional changes",
  "Emotional stress",
  "Chemicals/fragrances",
  "Foods",
  "Light",
  "Heat",
  "Cold",
  "Noise",
  "Visual overload",
  "Sensory overload",
  "Watching movement",
  "Mold/environmental",
]);

export const PROM_NEURO_DSQ2_RECOVERY_OPTIONS = deepFreeze([
  "Less than 1 hour",
  "Several hours",
  "1 day",
  "2–3 days",
  "4–7 days",
  "More than 1 week",
]);

export const PROM_NEURO_CHALDER_PHYSICAL_Q = deepFreeze([
  "Do you have problems with fatigue?",
  "Do you need to rest more?",
  "Do you feel sleepy or drowsy?",
  "Do you have problems starting things?",
  "Do you start things without difficulty but get weak as you go on?",
  "Do you feel less strong in your muscles?",
  "Do you feel weak?",
  "Do you have difficulties concentrating?",
]);

export const PROM_NEURO_CHALDER_MENTAL_Q = deepFreeze([
  "Do you have problems with your memory?",
  "Do you have difficulties thinking clearly?",
  "Do you make slips of the tongue when talking?",
]);

export const PROM_NEURO_CHALDER_OPTIONS_LIKERT = deepFreeze(["Less than usual", "No more than usual", "More than usual", "Much more than usual"]);

export const PROM_NEURO_CHALDER_OPTIONS_LABELS = deepFreeze(["Less", "No more", "More", "Much more"]);

export const PROM_NEURO_SF36_SF36_QUESTIONS = deepFreeze([
  // Physical Functioning (PF) - Questions 3a-3j
  { id: 1, domain: "PF", text: "Vigorous activities (e.g., running, lifting heavy objects, participating in strenuous sports)", scale: "extent" },
  { id: 2, domain: "PF", text: "Moderate activities (e.g., moving a table, pushing a vacuum cleaner, bowling, or playing golf)", scale: "extent" },
  { id: 3, domain: "PF", text: "Lifting or carrying groceries", scale: "extent" },
  { id: 4, domain: "PF", text: "Climbing several flights of stairs", scale: "extent" },
  { id: 5, domain: "PF", text: "Climbing one flight of stairs", scale: "extent" },
  { id: 6, domain: "PF", text: "Bending, kneeling, or stooping", scale: "extent" },
  { id: 7, domain: "PF", text: "Walking more than a mile", scale: "extent" },
  { id: 8, domain: "PF", text: "Walking several blocks", scale: "extent" },
  { id: 9, domain: "PF", text: "Walking one block", scale: "extent" },
  { id: 10, domain: "PF", text: "Bathing or dressing yourself", scale: "extent" },

  // Role-Physical (RP) - Questions 4a-4d
  { id: 11, domain: "RP", text: "Accomplished less due to physical health problems", scale: "yesno" },
  { id: 12, domain: "RP", text: "Limitations in type of work or other activities due to physical health", scale: "yesno" },
  { id: 13, domain: "RP", text: "Difficulty with work or other activities (due to physical health)", scale: "yesno" },
  { id: 14, domain: "RP", text: "Pain interfered with work or other activities", scale: "yesno" },

  // Bodily Pain (BP) - Questions 7-8
  { id: 15, domain: "BP", text: "Bodily pain in past 4 weeks", scale: "pain" },
  { id: 16, domain: "BP", text: "Pain interfered with normal work (including work outside home)", scale: "interference" },

  // General Health (GH) - Questions 1, 11a-11d
  { id: 17, domain: "GH", text: "In general, would you say your health is...", scale: "health" },
  { id: 18, domain: "GH", text: "I seem to get sick a little easier than other people", scale: "agreement" },
  { id: 19, domain: "GH", text: "I am as healthy as anybody I know", scale: "agreement" },
  { id: 20, domain: "GH", text: "I expect my health to get worse", scale: "agreement" },
  { id: 21, domain: "GH", text: "My health is excellent", scale: "agreement" },

  // Vitality (VT) - Questions 9d, 9e, 9g, 9i
  { id: 22, domain: "VT", text: "Feel full of pep (energy)", scale: "frequency" },
  { id: 23, domain: "VT", text: "Have a lot of energy", scale: "frequency" },
  { id: 24, domain: "VT", text: "Feel worn out", scale: "frequency" },
  { id: 25, domain: "VT", text: "Feel tired", scale: "frequency" },

  // Social Functioning (SF) - Questions 6, 10
  { id: 26, domain: "SF", text: "Physical health or emotional problems interfered with social activities", scale: "extent" },
  { id: 27, domain: "SF", text: "Extent health problems limited social activities", scale: "extent" },

  // Role-Emotional (RE) - Questions 5a-5c
  { id: 28, domain: "RE", text: "Accomplished less due to emotional problems", scale: "yesno" },
  { id: 29, domain: "RE", text: "Did not work as carefully (due to emotional problems)", scale: "yesno" },
  { id: 30, domain: "RE", text: "Emotional problems limited work or other activities", scale: "yesno" },

  // Mental Health (MH) - Questions 9b, 9c, 9f, 9h, 9a
  { id: 31, domain: "MH", text: "Feel calm and peaceful", scale: "frequency" },
  { id: 32, domain: "MH", text: "Felt down-hearted and blue", scale: "frequency" },
  { id: 33, domain: "MH", text: "Feel very nervous", scale: "frequency" },
  { id: 34, domain: "MH", text: "Feel downhearted and depressed", scale: "frequency" },
  { id: 35, domain: "MH", text: "Feel happy", scale: "frequency" },
  { id: 36, domain: "MH", text: "Felt so down that nothing could cheer you up", scale: "frequency" },
]);

export const PROM_NEURO_SF36_SCALE_OPTIONS = deepFreeze({
  extent: [
    { value: "3", label: "Yes, limited a lot" },
    { value: "2", label: "Yes, limited a little" },
    { value: "1", label: "No, not limited at all" }
  ],
  yesno: [
    { value: "2", label: "Yes" },
    { value: "1", label: "No" }
  ],
  pain: [
    { value: "6", label: "None" },
    { value: "5", label: "Very mild" },
    { value: "4", label: "Mild" },
    { value: "3", label: "Moderate" },
    { value: "2", label: "Severe" },
    { value: "1", label: "Very severe" }
  ],
  interference: [
    { value: "1", label: "Not at all" },
    { value: "2", label: "A little bit" },
    { value: "3", label: "Moderately" },
    { value: "4", label: "Quite a bit" },
    { value: "5", label: "Extremely" }
  ],
  health: [
    { value: "5", label: "Excellent" },
    { value: "4", label: "Very good" },
    { value: "3", label: "Good" },
    { value: "2", label: "Fair" },
    { value: "1", label: "Poor" }
  ],
  agreement: [
    { value: "5", label: "Strongly agree" },
    { value: "4", label: "Agree" },
    { value: "3", label: "Unsure" },
    { value: "2", label: "Disagree" },
    { value: "1", label: "Strongly disagree" }
  ],
  frequency: [
    { value: "6", label: "All of the time" },
    { value: "5", label: "Most of the time" },
    { value: "4", label: "A good bit of the time" },
    { value: "3", label: "Some of the time" },
    { value: "2", label: "A little of the time" },
    { value: "1", label: "None of the time" }
  ]
});

export const PROM_NEURO_PROMIS_FATIGUE_SCORING_TABLE = deepFreeze([
  { rawScore: 8, tScore: 33.1 },
  { rawScore: 9, tScore: 38.5 },
  { rawScore: 10, tScore: 41.0 },
  { rawScore: 11, tScore: 42.8 },
  { rawScore: 12, tScore: 44.3 },
  { rawScore: 13, tScore: 45.6 },
  { rawScore: 14, tScore: 46.9 },
  { rawScore: 15, tScore: 48.1 },
  { rawScore: 16, tScore: 49.2 },
  { rawScore: 17, tScore: 50.4 },
  { rawScore: 18, tScore: 51.5 },
  { rawScore: 19, tScore: 52.5 },
  { rawScore: 20, tScore: 53.6 },
  { rawScore: 21, tScore: 54.6 },
  { rawScore: 22, tScore: 55.6 },
  { rawScore: 23, tScore: 56.6 },
  { rawScore: 24, tScore: 57.5 },
  { rawScore: 25, tScore: 58.5 },
  { rawScore: 26, tScore: 59.4 },
  { rawScore: 27, tScore: 60.4 },
  { rawScore: 28, tScore: 61.3 },
  { rawScore: 29, tScore: 62.3 },
  { rawScore: 30, tScore: 63.3 },
  { rawScore: 31, tScore: 64.3 },
  { rawScore: 32, tScore: 65.3 },
  { rawScore: 33, tScore: 66.4 },
  { rawScore: 34, tScore: 67.5 },
  { rawScore: 35, tScore: 68.6 },
  { rawScore: 36, tScore: 69.8 },
  { rawScore: 37, tScore: 71.0 },
  { rawScore: 38, tScore: 72.4 },
  { rawScore: 39, tScore: 74.2 },
  { rawScore: 40, tScore: 77.8 }
]);

export const PROM_NEURO_PSQI_COMPONENTS = deepFreeze([
  { label: "Subjective Sleep Quality", key: "c1" },
  { label: "Sleep Latency", key: "c2" },
  { label: "Sleep Duration", key: "c3" },
  { label: "Habitual Sleep Efficiency", key: "c4" },
  { label: "Sleep Disturbances", key: "c5" },
  { label: "Use of Sleep Medication", key: "c6" },
  { label: "Daytime Dysfunction", key: "c7" },
]);

export const PROM_NEURO_PSQI_Q1_OPTIONS = deepFreeze([
  { label: "Very good", value: 0 },
  { label: "Fairly good", value: 1 },
  { label: "Fairly bad", value: 2 },
  { label: "Very bad", value: 3 },
]);

export const PROM_NEURO_PSQI_FREQ_OPTIONS = deepFreeze([
  { label: "Not during the past month", value: 0 },
  { label: "Less than once a week", value: 1 },
  { label: "Once or twice a week", value: 2 },
  { label: "Three or more times a week", value: 3 },
]);

export const PROM_NEURO_PSQI_LATENCY_MIN_OPTIONS = deepFreeze([
  { label: "≤15 minutes", value: 0 },
  { label: "16–30 minutes", value: 1 },
  { label: "31–60 minutes", value: 2 },
  { label: ">60 minutes", value: 3 },
]);

export const PROM_NEURO_PSQI_DURATION_OPTIONS = deepFreeze([
  { label: "More than 7 hours", value: 0 },
  { label: "6–7 hours", value: 1 },
  { label: "5–6 hours", value: 2 },
  { label: "Less than 5 hours", value: 3 },
]);

export const PROM_NEURO_PSQI_DYSFUNCTION_OPTIONS = deepFreeze([
  { label: "No problem at all", value: 0 },
  { label: "Only a very slight problem", value: 1 },
  { label: "Somewhat of a problem", value: 2 },
  { label: "A very big problem", value: 3 },
]);

export const PROM_NEURO_DGI_TASKS = deepFreeze([
  {
    name: "Gait level surface",
    instructions: 'Say: "Walk at your normal speed from here to the next mark (20 feet)." Walk alongside or behind for safety. Observe stride length, arm swing, trunk stability, and foot clearance.',
    scores: ["Unable to walk 20 feet safely without assistance", "Walks with assistive device, slow speed, abnormal gait, or evidence of imbalance", "Walks 20 feet; slow speed or abnormal gait pattern", "Walks 20 feet, no assistive device, good speed, no evidence of imbalance"]
  },
  {
    name: "Changing gait speed",
    instructions: 'Say: "Begin walking at your normal pace. When I say \'go faster\', walk as fast as you can. When I say \'slow down\', walk as slowly as you can." Observe ability to change speed smoothly without loss of balance.',
    scores: ["Unable to change speeds; severe imbalance or assistance required", "Makes minimal speed adjustments; significant deviation, imbalance, or stops", "Able to change speed with minor deviations or uses assistive device", "Safely changes speed without loss of balance or deviation"]
  },
  {
    name: "Gait with horizontal head turns",
    instructions: 'Say: "Walk from here to the mark. When I say \'look right\', turn your head right. When I say \'look left\', turn your head left." Call turns every 3–5 steps. Observe veering, stumbling, or imbalance.',
    scores: ["Cannot perform or needs assistance; severe imbalance", "Severe disruption to gait; stops, grabs support, or marked deviation", "Head turns cause slight change in gait speed or minor deviation; recovers", "Performs head turns with no change in gait speed or direction"]
  },
  {
    name: "Gait with vertical head turns",
    instructions: 'Say: "Walk from here to the mark. When I say \'look up\', tip your head up. When I say \'look down\', tip your head down." Call turns every 3–5 steps. Observe loss of balance or veering.',
    scores: ["Cannot perform or needs assistance; severe imbalance", "Severe disruption to gait; stops, grabs support, or marked deviation", "Head turns cause slight change in gait speed or minor deviation; recovers", "Performs head turns with no change in gait speed or direction"]
  },
  {
    name: "Gait and pivot turn",
    instructions: 'Say: "Walk to the mark (6 feet), turn around and walk back." Observe quality of turn: balance, steadiness, number of steps, and need to grab support.',
    scores: ["Cannot turn safely; falls or requires assistance", "Turns slowly; more than 4 steps; stops to regain balance before/after turn", "Turns safely; uses more than 4 steps to complete turn", "Turns safely in 4 steps or fewer; no loss of balance"]
  },
  {
    name: "Step over obstacle",
    instructions: 'Place a shoebox (~6 inches high) on the walkway. Say: "Walk from here to the mark and step over the box; do not go around it." Observe foot clearance, stride disruption, and trunk control.',
    scores: ["Cannot step over obstacle; trips or requires assistance", "Steps over obstacle but requires stopping or shows significant deviation/imbalance", "Steps over obstacle with minor deviation or slowing", "Steps over obstacle with no change in gait speed; no evidence of imbalance"]
  },
  {
    name: "Step around obstacles",
    instructions: 'Place 2 cones at 6 and 12 feet in the path. Say: "Walk from here to the mark. Go around the right side of the first cone, then the left side of the second." Observe lateral trunk control and stability.',
    scores: ["Cannot navigate around obstacles; requires assistance", "Unable to avoid obstacles cleanly; stops, steps around awkwardly, or shows imbalance", "Walks around both cones with minor deviation or slowing", "Walks around both cones with no gait deviation or evidence of imbalance"]
  },
  {
    name: "Steps",
    instructions: 'Lead client to stairs. Say: "Walk up and down these stairs the way you would at home." Allow handrail use. Observe step height, rhythm, handrail reliance, foot placement, and trunk stability during both ascent and descent.',
    scores: ["Cannot perform stairs safely; requires assistance or high fall risk", "Ascends/descends but relies on handrail throughout, or one step at a time", "Ascends/descends with minimal handrail use or slower than normal; minor deviation", "Ascends and descends safely, alternating feet, with or without handrail; good control"]
  },
]);

export const PROM_NEURO_FGA_ITEMS = deepFreeze([
  { id: "gait_level", label: "1. Gait on Level Surface" },
  { id: "change_speed", label: "2. Change in Gait Speed" },
  { id: "horizontal_head", label: "3. Gait with Horizontal Head Turns" },
  { id: "vertical_head", label: "4. Gait with Vertical Head Turns" },
  { id: "pivot_turn", label: "5. Gait and Pivot Turn" },
  { id: "over_obstacle", label: "6. Step Over Obstacle" },
  { id: "narrow_bos", label: "7. Gait with Narrow Base of Support" },
  { id: "eyes_closed", label: "8. Gait with Eyes Closed" },
  { id: "backwards", label: "9. Walking Backwards" },
  { id: "stairs", label: "10. Steps" },
]);

export const PROM_NEURO_FGA_SCORE_LABELS = deepFreeze(["0 — Severe impairment", "1 — Moderate impairment", "2 — Mild impairment", "3 — Normal"]);

export const PROM_NEURO_PARQ_PARQ_QUESTIONS = deepFreeze([
  "Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?",
  "Do you feel pain in your chest when you do physical activity?",
  "In the past month, have you had chest pain when you were not doing physical activity?",
  "Do you lose your balance because of dizziness or do you ever lose consciousness?",
  "Do you have a bone or joint problem (for example, back, knee or hip) that could be made worse by a change in your physical activity?",
  "Is your doctor currently prescribing drugs (for example, water pills) for your blood pressure or heart condition?",
  "Do you know of any other reason why you should not do physical activity?"
]);

export const PROM_NEURO_HIMAT_ITEMS = deepFreeze([
  {
    key: "walk",
    label: "Walk (8m)",
    max: 6,
    description: "Normal walking at natural pace",
    scoringCriteria: {
      6: "Completes 8m walk smoothly; normal speed; coordinated arm swing; even cadence",
      5: "Completes walk with minor deviations; slightly reduced speed; minimal balance adjustment",
      4: "Walks 8m with noticeable gait deviation; slow but safe; may use rail or reduce stride length",
      3: "Walks 8m but requires supervision; marked gait asymmetry; multiple balance corrections",
      2: "Walks <8m or requires verbal/tactile cuing; unsafe without close supervision",
      1: "Attempts to walk but unable to complete 8m safely; severe gait dysfunction",
      0: "Unable to attempt or unsafe to continue; declines task"
    }
  },
  {
    key: "walk_backwards",
    label: "Walk backwards (8m)",
    max: 6,
    description: "Backward walking at controlled pace",
    scoringCriteria: {
      6: "Walks backward 8m smoothly; good speed control; minimal trunk rotation",
      5: "Walks backward 8m with occasional balance checks; slightly cautious",
      4: "Walks backward 8m with frequent balance corrections; slow and deliberate",
      3: "Walks backward <8m safely; requires verbal cues or close supervision; poor coordination",
      2: "Walks backward <4m or requires manual assistance; unable to maintain direction",
      1: "Attempts backward walk but unable to maintain direction; unsafe",
      0: "Unable to attempt or declines task"
    }
  },
  {
    key: "walk_on_toes",
    label: "Walk on toes (8m)",
    max: 6,
    description: "Walking on ball of feet, heels off ground",
    scoringCriteria: {
      6: "Completes 8m on toes with good balance; consistent heel clearance; smooth cadence",
      5: "Completes 8m on toes with minor balance checks; maintains height",
      4: "Walks 8m on toes with frequent balance corrections; reduced height; slow speed",
      3: "Walks <8m on toes; requires supervision; marked balance loss; feet touch down",
      2: "Walks <4m on toes; unable to maintain position; heels repeatedly touch ground",
      1: "Attempts but unable to maintain toe-walking; immediate balance loss",
      0: "Unable to attempt or declines task"
    }
  },
  {
    key: "run",
    label: "Run (8m)",
    max: 6,
    description: "Running at self-paced speed",
    scoringCriteria: {
      6: "Runs 8m smoothly; even pace; coordinated arm/leg movement; controlled landing",
      5: "Runs 8m with minor asymmetry; good speed; safe stopping",
      4: "Jogs 8m at reduced speed; noticeable gait deviation; safe but cautious",
      3: "Jogs <8m with supervision; irregular rhythm; balance concerns noted",
      2: "Jogs <4m or requires verbal cuing; unsafe gait pattern",
      1: "Attempts running but transitions to walk immediately; unable to run",
      0: "Unable to attempt or declines task"
    }
  },
  {
    key: "skip",
    label: "Skip (8m)",
    max: 6,
    description: "Continuous skipping without stopping",
    scoringCriteria: {
      6: "Skips 8m continuously; even rhythm; good height and distance per skip; coordinated",
      5: "Skips 8m with minor rhythm breaks; maintains height; slight asymmetry",
      4: "Skips 8m with frequent rhythm breaks; reduced height; slow but continuous",
      3: "Skips <8m with poor rhythm; requires supervision; limited hop height",
      2: "Skips <4m; unable to maintain continuous rhythm; transitions to walk",
      1: "Attempts skipping but unable to coordinate; immediately breaks into walk",
      0: "Unable to attempt or declines task"
    }
  },
  {
    key: "hop_on_spot",
    label: "Hop on spot (single leg)",
    max: 6,
    description: "Continuous hopping on one leg in place",
    scoringCriteria: {
      6: "Completes 10+ hops on each leg; good balance; consistent height; controlled landing",
      5: "Completes 8–10 hops per leg; minor balance loss; stable",
      4: "Completes 5–7 hops per leg; noticeable balance corrections; lower height",
      3: "Completes 3–4 hops per leg; requires supervision; poor balance; low height",
      2: "Completes 1–2 hops per leg; unable to continue; marked instability",
      1: "Attempts single-leg hop but unable to perform; immediate balance loss",
      0: "Unable to attempt or declines task"
    }
  },
  {
    key: "forward_bound",
    label: "Forward bound",
    max: 6,
    description: "Continuous bounding forward",
    scoringCriteria: {
      6: "Bounds 8m continuously; good distance per bound; strong propulsion; controlled landing",
      5: "Bounds 8m with minor asymmetry; good distance; stable transitions",
      4: "Bounds 8m with reduced distance per bound; noticeable asymmetry; cautious",
      3: "Bounds <8m; poor coordination; requires supervision; balance concerns",
      2: "Bounds <4m; unable to maintain pattern; high fall risk",
      1: "Attempts bounding but unable to coordinate; immediate transition to walk",
      0: "Unable to attempt or declines task"
    }
  },
  {
    key: "stair_walk_up",
    label: "Stair walk — up",
    max: 4,
    description: "Walking up stairs at natural pace (≥12 stairs)",
    scoringCriteria: {
      4: "Ascends stairs smoothly; normal speed; no rail use; normal stepping pattern",
      3: "Ascends stairs safely; uses rail; slightly slow; one foot per step",
      2: "Ascends with supervision; uses rail; slow; limited step height; marked fatigue",
      1: "Ascends with close assistance; limited steps; high effort; poor safety",
      0: "Unable to attempt or unsafe"
    }
  },
  {
    key: "stair_walk_down",
    label: "Stair walk — down",
    max: 4,
    description: "Walking down stairs at natural pace",
    scoringCriteria: {
      4: "Descends stairs smoothly; normal speed; no rail use; balanced",
      3: "Descends safely; uses rail; slightly cautious; one foot per step",
      2: "Descends with supervision; uses rail; slow; frequent balance checks; high caution",
      1: "Descends with close assistance; minimal steps; requires verbal cuing; poor safety",
      0: "Unable to attempt or unsafe"
    }
  },
  {
    key: "stair_run_up",
    label: "Stair run — up",
    max: 4,
    description: "Running up stairs at maximum safe speed",
    scoringCriteria: {
      4: "Runs up stairs at brisk pace; some steps skipped; good propulsion; controlled",
      3: "Runs up stairs at moderate pace; one step per stride; safe; slightly slow",
      2: "Jogs up stairs with supervision; slow pace; one step per stride; high caution",
      1: "Walks up stairs quickly or jogs with close assistance; unsafe without help",
      0: "Unable to attempt or unsafe"
    }
  },
]);

export const PROM_NEURO_AQOL_QUESTIONS = deepFreeze([
  {
    id: "aqol1",
    domain: "Independent Living",
    text: "Do you need any help looking after yourself? (For example: dressing, bathing, eating)",
    options: [
      { label: "I need no help at all.", value: 0 },
      { label: "Occasionally I need some help with personal care tasks.", value: 1 },
      { label: "I need help with the more difficult personal care tasks.", value: 2 },
      { label: "I need daily help with most or all personal care tasks.", value: 3 },
    ],
  },
  {
    id: "aqol2",
    domain: "Independent Living",
    text: "When doing household tasks: (For example: cooking, cleaning the house, washing)",
    options: [
      { label: "I need no help at all.", value: 0 },
      { label: "Occasionally I need some help with household tasks.", value: 1 },
      { label: "I need help with the more difficult household tasks.", value: 2 },
      { label: "I need daily help with most or all household tasks.", value: 3 },
    ],
  },
  {
    id: "aqol3",
    domain: "Independent Living",
    text: "Thinking about how easily you can get around your home and community:",
    options: [
      { label: "I get around my home and community by myself without any difficulty.", value: 0 },
      { label: "I find it difficult to get around my home and community by myself.", value: 1 },
      { label: "I cannot get around the community by myself, but I can get around my home with some difficulty.", value: 2 },
      { label: "I cannot get around either the community or my home by myself.", value: 3 },
    ],
  },
  {
    id: "aqol4",
    domain: "Relationships",
    text: "Because of your health, your relationships (for example: with your friends, partner or parents) generally:",
    options: [
      { label: "Are very close and warm.", value: 0 },
      { label: "Are sometimes close and warm.", value: 1 },
      { label: "Are seldom close and warm.", value: 2 },
      { label: "I have no close and warm relationships.", value: 3 },
    ],
  },
  {
    id: "aqol5",
    domain: "Relationships",
    text: "Thinking about your relationship with other people:",
    options: [
      { label: "I have plenty of friends, and am never lonely.", value: 0 },
      { label: "Although I have friends, I am occasionally lonely.", value: 1 },
      { label: "I have some friends, but am often lonely for company.", value: 2 },
      { label: "I am socially isolated and feel lonely.", value: 3 },
    ],
  },
  {
    id: "aqol6",
    domain: "Relationships",
    text: "Thinking about your health and your relationship with your family:",
    options: [
      { label: "My role in the family is unaffected by my health.", value: 0 },
      { label: "There are some parts of my family role I cannot carry out.", value: 1 },
      { label: "There are many parts of my family role I cannot carry out.", value: 2 },
      { label: "I cannot carry out any part of my family role.", value: 3 },
    ],
  },
  {
    id: "aqol7",
    domain: "Senses",
    text: "Thinking about your vision, including when using your glasses or contact lenses if needed:",
    options: [
      { label: "I see normally.", value: 0 },
      { label: "I have some difficulty focusing on things, or I do not see them sharply (e.g. small print, newspaper or seeing objects in the distance).", value: 1 },
      { label: "I have a lot of difficulty seeing things. My vision is blurred (e.g. I can see just enough to get by with).", value: 2 },
      { label: "I only see general shapes, or am blind (e.g. I need a guide to move around).", value: 3 },
    ],
  },
  {
    id: "aqol8",
    domain: "Senses",
    text: "Thinking about your hearing, including using your hearing aid if needed:",
    options: [
      { label: "I hear normally.", value: 0 },
      { label: "I have some difficulty hearing or I do not hear clearly (e.g. I ask people to speak up, or turn up the TV/radio volume).", value: 1 },
      { label: "I have difficulty hearing things clearly. Often I do not understand what is said. I usually do not take part in conversations because I cannot hear.", value: 2 },
      { label: "I hear very little indeed. I cannot fully understand loud voices speaking directly to me.", value: 3 },
    ],
  },
  {
    id: "aqol9",
    domain: "Senses",
    text: "When you communicate with others: (For example: by talking, listening, writing or signing.)",
    options: [
      { label: "I have no trouble speaking to them or understanding what they are saying.", value: 0 },
      { label: "I have some difficulty being understood by people who do not know me. I have no trouble understanding what others say.", value: 1 },
      { label: "I am only understood by people who know me well. I have great trouble understanding what others are saying to me.", value: 2 },
      { label: "I cannot adequately communicate with others.", value: 3 },
    ],
  },
  {
    id: "aqol10",
    domain: "Mental Health",
    text: "Thinking about how you sleep:",
    options: [
      { label: "I am able to sleep without difficulty most of the time.", value: 0 },
      { label: "My sleep is interrupted some of the time, but I am usually able to go back to sleep without difficulty.", value: 1 },
      { label: "My sleep is interrupted most nights, but I am usually able to go back to sleep without difficulty.", value: 2 },
      { label: "I sleep in short bursts only. I am awake most of the night.", value: 3 },
    ],
  },
  {
    id: "aqol11",
    domain: "Mental Health",
    text: "Thinking about how you generally feel:",
    options: [
      { label: "I do not feel anxious, worried or depressed.", value: 0 },
      { label: "I am slightly anxious, worried or depressed.", value: 1 },
      { label: "I feel moderately anxious, worried or depressed.", value: 2 },
      { label: "I am extremely anxious, worried or depressed.", value: 3 },
    ],
  },
  {
    id: "aqol12",
    domain: "Mental Health",
    text: "How much pain or discomfort do you experience:",
    options: [
      { label: "None at all.", value: 0 },
      { label: "I have moderate pain.", value: 1 },
      { label: "I suffer from severe pain.", value: 2 },
      { label: "I suffer unbearable pain.", value: 3 },
    ],
  },
]);

export const PROM_NEURO_AQOL_DOMAINS = deepFreeze(["Independent Living", "Relationships", "Senses", "Mental Health"]);

export const PROM_NEURO_AQOL_DOMAIN_COLORS = deepFreeze({
  "Independent Living": "bg-blue-100 text-blue-800 border-blue-200",
  "Relationships": "bg-purple-100 text-purple-800 border-purple-200",
  "Senses": "bg-amber-100 text-amber-800 border-amber-200",
  "Mental Health": "bg-green-100 text-green-800 border-green-200",
});

export const PROM_NEURO_SPADI_PAIN_ITEMS = deepFreeze([
  "At its worst?",
  "When lying on the involved side?",
  "Reaching for something on a high shelf?",
  "Touching the back of your neck?",
  "Pushing with the involved arm?",
]);

export const PROM_NEURO_SPADI_DISABILITY_ITEMS = deepFreeze([
  "Washing your hair?",
  "Washing your back?",
  "Putting on an undershirt or pullover sweater?",
  "Putting on a shirt that buttons down the front?",
  "Putting on your pants?",
  "Placing an object on a high shelf?",
  "Carrying a heavy object of 10 pounds (4.5 kg)?",
  "Removing something from your back pocket?",
]);

export const PROM_NEURO_BREQ_ITEMS = deepFreeze([
  { num: 1,  text: "I exercise because other people say I should",                    subscale: "external" },
  { num: 2,  text: "I feel guilty when I don't exercise",                              subscale: "introjected" },
  { num: 3,  text: "I value the benefits of exercise",                                 subscale: "identified" },
  { num: 4,  text: "I exercise because it's fun",                                      subscale: "intrinsic" },
  { num: 5,  text: "I don't see why I should have to exercise",                        subscale: "amotivation" },
  { num: 6,  text: "I take part in exercise because my friends/family/partner say I should", subscale: "external" },
  { num: 7,  text: "I feel ashamed when I miss an exercise session",                   subscale: "introjected" },
  { num: 8,  text: "It's important to me to exercise regularly",                       subscale: "identified" },
  { num: 9,  text: "I can't see why I should bother exercising",                       subscale: "amotivation" },
  { num: 10, text: "I enjoy my exercise sessions",                                     subscale: "intrinsic" },
  { num: 11, text: "I exercise because others will not be pleased with me if I don't", subscale: "external" },
  { num: 12, text: "I don't see the point in exercising",                              subscale: "amotivation" },
  { num: 13, text: "I feel like a failure when I haven't exercised in a while",        subscale: "introjected" },
  { num: 14, text: "I think it is important to make the effort to exercise regularly", subscale: "identified" },
  { num: 15, text: "I find exercise a pleasurable activity",                           subscale: "intrinsic" },
  { num: 16, text: "I feel under pressure from my friends/family to exercise",         subscale: "external" },
  { num: 17, text: "I get restless if I don't exercise regularly",                     subscale: "identified" },
  { num: 18, text: "I get pleasure and satisfaction from participating in exercise",   subscale: "intrinsic" },
  { num: 19, text: "I think exercising is a waste of time",                            subscale: "amotivation" },
]);

export const PROM_NEURO_BREQ_RESPONSE_OPTIONS = deepFreeze([
  { value: 0, label: "0 – Not true for me" },
  { value: 1, label: "1 – Not very true for me" },
  { value: 2, label: "2 – Sometimes true for me" },
  { value: 3, label: "3 – Often true for me" },
  { value: 4, label: "4 – Very true for me" },
]);

export const PROM_NEURO_BREQ_SUBSCALE_INFO = deepFreeze({
  amotivation:   { label: "Amotivation",           color: "bg-red-100 text-red-800 border-red-200",     items: [5,9,12,19] },
  external:      { label: "External Regulation",   color: "bg-orange-100 text-orange-800 border-orange-200", items: [1,6,11,16] },
  introjected:   { label: "Introjected Regulation",color: "bg-yellow-100 text-yellow-800 border-yellow-200", items: [2,7,13] },
  identified:    { label: "Identified Regulation", color: "bg-blue-100 text-blue-800 border-blue-200",   items: [3,8,14,17] },
  intrinsic:     { label: "Intrinsic Motivation",  color: "bg-green-100 text-green-800 border-green-200", items: [4,10,15,18] },
});

export const PROM_NEURO_PASE_LEISURE_ITEMS = deepFreeze([
  { id: "walking", label: "Walking for exercise" },
  { id: "light_sport", label: "Light sport / recreation (e.g. bowling, golf)" },
  { id: "moderate_sport", label: "Moderate sport / recreation (e.g. doubles tennis, ballroom dancing)" },
  { id: "strenuous_sport", label: "Strenuous sport / recreation (e.g. swimming, singles tennis, aerobics)" },
  { id: "muscle_exercise", label: "Muscle strengthening exercises (e.g. weights, resistance bands)" },
]);

export const PROM_NEURO_PASE_LEISURE_HOURS = deepFreeze([
  { value: 1, label: "< 1 hr/week" },
  { value: 2, label: "1–2 hrs/week" },
  { value: 3, label: "2–4 hrs/week" },
  { value: 4, label: "> 4 hrs/week" },
]);

export const PROM_NEURO_PASE_LEISURE_WEIGHTS = deepFreeze({
  walking: [0.11, 0.32, 0.64, 1.07],
  light_sport: [0.13, 0.38, 0.76, 1.27],
  moderate_sport: [0.25, 0.75, 1.50, 2.50],
  strenuous_sport: [0.38, 1.13, 2.26, 3.77],
  muscle_exercise: [0.19, 0.57, 1.14, 1.90],
});

export const PROM_NEURO_PASE_HOUSEHOLD_ITEMS = deepFreeze([
  { id: "light_housework", label: "Light housework (e.g. dusting, washing dishes)" },
  { id: "heavy_housework", label: "Heavy housework (e.g. vacuuming, scrubbing floors)" },
  { id: "home_repairs", label: "Home repairs (e.g. painting, carpentry)" },
  { id: "lawn_garden", label: "Lawn work or gardening" },
  { id: "outdoor_tasks", label: "Outdoor work or yardwork (e.g. mowing, raking, watering)" },
  { id: "caregiving", label: "Caring for another person (e.g. child, elderly)" },
]);

export const PROM_NEURO_PASE_HOUSEHOLD_WEIGHTS = deepFreeze({
  light_housework: 0.25,
  heavy_housework: 0.50,
  home_repairs: 0.50,
  lawn_garden: 0.50,
  outdoor_tasks: 0.50,
  caregiving: 0.35,
});

export const PROM_NEURO_PASE_WORK_ITEM = deepFreeze({
  id: "work",
  label: "Worked for pay or as a volunteer",
});

export const PROM_NEURO_PASE_WORK_HOURS = deepFreeze([
  { value: 1, label: "< 10 hrs/week" },
  { value: 2, label: "10–19 hrs/week" },
  { value: 3, label: "20–29 hrs/week" },
  { value: 4, label: "30–39 hrs/week" },
  { value: 5, label: "≥ 40 hrs/week" },
]);

export const PROM_NEURO_WOMAC_WOMAC_SECTIONS = deepFreeze({
  pain: [
    "Walking on a flat surface",
    "Going up or down stairs",
    "At night while in bed",
    "Sitting or lying",
    "Standing upright"
  ],
  stiffness: [
    "After first waking in the morning",
    "After sitting, lying, or resting later in the day"
  ],
  function: [
    "Descending stairs",
    "Ascending stairs",
    "Rising from sitting",
    "Standing",
    "Bending to floor",
    "Walking on flat surface",
    "Getting in/out of car",
    "Going shopping",
    "Putting on socks",
    "Rising from bed",
    "Taking off socks",
    "Lying in bed",
    "Getting in/out of bath",
    "Sitting",
    "Getting on/off toilet",
    "Heavy domestic duties",
    "Light domestic duties"
  ]
});

export const PROM_NEURO_STROOP_TRIAL1_WORDS = deepFreeze([
  { word: "RED", color: "#1a1a1a" }, { word: "BLUE", color: "#1a1a1a" },
  { word: "GREEN", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
  { word: "RED", color: "#1a1a1a" }, { word: "GREEN", color: "#1a1a1a" },
  { word: "BLUE", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
  { word: "GREEN", color: "#1a1a1a" }, { word: "RED", color: "#1a1a1a" },
  { word: "BLUE", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
  { word: "RED", color: "#1a1a1a" }, { word: "GREEN", color: "#1a1a1a" },
  { word: "BLUE", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
  { word: "GREEN", color: "#1a1a1a" }, { word: "RED", color: "#1a1a1a" },
  { word: "BLUE", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
]);

export const PROM_NEURO_STROOP_TRIAL2_COLORS = deepFreeze([
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
]);

export const PROM_NEURO_STROOP_TRIAL3_INTERFERENCE = deepFreeze([
  { word: "RED", color: "#2b6cb0", correct: "BLUE" },
  { word: "BLUE", color: "#276749", correct: "GREEN" },
  { word: "GREEN", color: "#e53e3e", correct: "RED" },
  { word: "YELLOW", color: "#2b6cb0", correct: "BLUE" },
  { word: "RED", color: "#b7791f", correct: "YELLOW" },
  { word: "BLUE", color: "#e53e3e", correct: "RED" },
  { word: "GREEN", color: "#b7791f", correct: "YELLOW" },
  { word: "YELLOW", color: "#276749", correct: "GREEN" },
  { word: "RED", color: "#276749", correct: "GREEN" },
  { word: "GREEN", color: "#2b6cb0", correct: "BLUE" },
  { word: "BLUE", color: "#b7791f", correct: "YELLOW" },
  { word: "YELLOW", color: "#e53e3e", correct: "RED" },
  { word: "RED", color: "#2b6cb0", correct: "BLUE" },
  { word: "GREEN", color: "#e53e3e", correct: "RED" },
  { word: "BLUE", color: "#276749", correct: "GREEN" },
  { word: "YELLOW", color: "#2b6cb0", correct: "BLUE" },
  { word: "RED", color: "#b7791f", correct: "YELLOW" },
  { word: "BLUE", color: "#e53e3e", correct: "RED" },
  { word: "GREEN", color: "#b7791f", correct: "YELLOW" },
  { word: "YELLOW", color: "#276749", correct: "GREEN" },
]);

export const PROM_NEURO_STROOP_NORMS_45S = deepFreeze({
  "17-29": { t1: { mean: 109, sd: 17 }, t2: { mean: 81, sd: 14 }, t3: { mean: 51, sd: 10 } },
  "30-39": { t1: { mean: 106, sd: 18 }, t2: { mean: 79, sd: 14 }, t3: { mean: 49, sd: 10 } },
  "40-49": { t1: { mean: 104, sd: 16 }, t2: { mean: 77, sd: 13 }, t3: { mean: 47, sd: 9 } },
  "50-59": { t1: { mean: 100, sd: 17 }, t2: { mean: 73, sd: 14 }, t3: { mean: 45, sd: 9 } },
  "60-69": { t1: { mean: 93, sd: 18 }, t2: { mean: 67, sd: 14 }, t3: { mean: 40, sd: 9 } },
  "70-79": { t1: { mean: 85, sd: 19 }, t2: { mean: 60, sd: 15 }, t3: { mean: 35, sd: 9 } },
  "80+":   { t1: { mean: 77, sd: 20 }, t2: { mean: 53, sd: 15 }, t3: { mean: 30, sd: 9 } },
});

export const PROM_NEURO_MAS_MUSCLES = deepFreeze([
  "Elbow Flexors",
  "Elbow Extensors",
  "Wrist Flexors",
  "Wrist Extensors",
  "Finger Flexors",
  "Hip Flexors",
  "Hip Extensors",
  "Hip Abductors",
  "Hip Adductors",
  "Knee Flexors",
  "Knee Extensors",
  "Ankle Plantarflexors",
  "Ankle Dorsiflexors"
]);

export const PROM_NEURO_MAS_MAS_GRADES = deepFreeze([
  { score: 0, label: "0 - No increase in muscle tone" },
  { score: 1, label: "1 - Slight increase in muscle tone" },
  { score: "1+", label: "1+ - Slight increase with brief catch" },
  { score: 2, label: "2 - Marked increase in muscle tone" },
  { score: 3, label: "3 - Considerable increase in muscle tone" },
  { score: 4, label: "4 - Rigid (passive movement difficult)" }
]);

export const PROM_NEURO_TARDIEU_MUSCLE_GROUPS = deepFreeze({
  "Upper Limb": [
    "Elbow Flexors", "Elbow Extensors", "Wrist Flexors", "Wrist Extensors",
    "Finger Flexors", "Shoulder Internal Rotators",
  ],
  "Lower Limb": [
    "Hamstrings", "Quadriceps", "Gastrocnemius", "Soleus",
    "Hip Adductors", "Hip Flexors", "Tibialis Posterior",
  ],
});

export const PROM_NEURO_TARDIEU_TARDIEU_SCORES = deepFreeze([
  { value: "0", label: "0 — No resistance throughout" },
  { value: "1", label: "1 — Slight resistance, no catch" },
  { value: "2", label: "2 — Clear catch at precise angle" },
  { value: "3", label: "3 — Fatigable clonus (< 10 sec)" },
  { value: "4", label: "4 — Unfatigable clonus (> 10 sec)" },
  { value: "5", label: "5 — Joint immobile" },
]);

export const PROM_NEURO_TARDIEU_VELOCITIES = deepFreeze([
  { key: "v1", label: "V1 — Slow Stretch", desc: "As slow as possible. Measures passive ROM (R2).", color: "bg-blue-50 border-blue-200" },
  { key: "v2", label: "V2 — Speed of Limb Under Gravity", desc: "Speed of limb falling under gravity. Moderate speed.", color: "bg-yellow-50 border-yellow-200" },
  { key: "v3", label: "V3 — Fast Stretch", desc: "As fast as possible. Used to provoke spasticity (R1).", color: "bg-red-50 border-red-200" },
]);

export const PROM_NEURO_BARTHEL_ITEMS = deepFreeze([
  {
    key: "feeding",
    label: "Feeding",
    description: "Ability to eat from a tray or plate when food is within reach.",
    options: [
      { value: 0, label: "0 – Unable (needs to be fed)" },
      { value: 5, label: "5 – Needs help (cutting, spreading butter, etc.)" },
      { value: 10, label: "10 – Independent (food provided within reach)" },
    ],
  },
  {
    key: "bathing",
    label: "Bathing",
    description: "Ability to bath or shower independently.",
    options: [
      { value: 0, label: "0 – Dependent" },
      { value: 5, label: "5 – Independent (bath, shower, or sponge bath)" },
    ],
  },
  {
    key: "grooming",
    label: "Grooming / Personal Hygiene",
    description: "Face washing, hair combing, shaving, teeth cleaning.",
    options: [
      { value: 0, label: "0 – Needs help" },
      { value: 5, label: "5 – Independent (implements provided)" },
    ],
  },
  {
    key: "dressing",
    label: "Dressing",
    description: "Ability to dress and undress, including buttons/zips and braces.",
    options: [
      { value: 0, label: "0 – Dependent" },
      { value: 5, label: "5 – Needs help (≥50% of task independently)" },
      { value: 10, label: "10 – Independent (including buttons, zips, braces)" },
    ],
  },
  {
    key: "bowelControl",
    label: "Bowel Control",
    description: "Ability to control bowels over the previous week.",
    options: [
      { value: 0, label: "0 – Incontinent (or needs enemas)" },
      { value: 5, label: "5 – Occasional accident (≤1/week)" },
      { value: 10, label: "10 – Continent" },
    ],
  },
  {
    key: "bladderControl",
    label: "Bladder Control",
    description: "Ability to control bladder over the previous week (or manages catheter).",
    options: [
      { value: 0, label: "0 – Incontinent / catheter not self-managed" },
      { value: 5, label: "5 – Occasional accident (≤1/24h)" },
      { value: 10, label: "10 – Continent (or self-manages catheter)" },
    ],
  },
  {
    key: "toiletUse",
    label: "Toilet Use",
    description: "Use of toilet or commode, including clothing and hygiene.",
    options: [
      { value: 0, label: "0 – Dependent" },
      { value: 5, label: "5 – Needs some help but can do some tasks independently" },
      { value: 10, label: "10 – Independent (on/off, dressing, wiping)" },
    ],
  },
  {
    key: "transfers",
    label: "Transfers (Bed ↔ Chair)",
    description: "Moving from bed to chair and back.",
    options: [
      { value: 0, label: "0 – Unable (no sitting balance)" },
      { value: 5, label: "5 – Major help (1–2 people, physical), can sit" },
      { value: 10, label: "10 – Minor help (verbal/physical)" },
      { value: 15, label: "15 – Independent" },
    ],
  },
  {
    key: "mobility",
    label: "Mobility (on level surfaces)",
    description: "Ability to walk on level ground or propel a wheelchair.",
    options: [
      { value: 0, label: "0 – Immobile or < 50 m" },
      { value: 5, label: "5 – Wheelchair independent ≥ 50 m" },
      { value: 10, label: "10 – Walks with help (verbal/physical) ≥ 50 m" },
      { value: 15, label: "15 – Independent (may use aid) ≥ 50 m" },
    ],
  },
  {
    key: "stairs",
    label: "Stairs",
    description: "Ability to ascend and descend a flight of stairs.",
    options: [
      { value: 0, label: "0 – Unable" },
      { value: 5, label: "5 – Needs help (verbal, physical, or carrying aid)" },
      { value: 10, label: "10 – Independent (may use rail or aid)" },
    ],
  },
]);

export const PROM_NEURO_ABC_ACTIVITIES = deepFreeze([
  "Walk around the house",
  "Walk up or down stairs",
  "Bend over and pick up a slipper",
  "Reach for small can at eye level",
  "Stand on tiptoes and reach",
  "Stand on chair and reach",
  "Sweep the floor",
  "Walk to car in driveway",
  "Get into or out of car",
  "Walk across parking lot",
  "Walk up or down ramp",
  "Walk in crowded mall",
  "Bumped into by people",
  "Step onto escalator (with railing)",
  "Step onto escalator (with parcels)",
  "Walk on icy sidewalks"
]);

export const PROM_NEURO_MAS_STROKE_ITEMS = deepFreeze([
  {
    key: "supineToSideLying",
    label: "1. Supine to Side Lying",
    grades: [
      { score: 0, desc: "Starting position: Supine, legs extended. Pulls self to side lying (not using bed rail). Rolls to side." },
      { score: 1, desc: "Rolls to side using unaffected arm but legs do not follow as a unit." },
      { score: 2, desc: "Rolls to side, legs follow body. Overall movement not coordinated." },
      { score: 3, desc: "Rolls to side in a coordinated movement. Leg lifts from bed." },
      { score: 4, desc: "Rolls to side in coordinated movement in 3 seconds." },
      { score: 5, desc: "Rolls to side in 2 seconds." },
      { score: 6, desc: "Rolls to side in 1 second." },
    ],
  },
  {
    key: "supineToSitting",
    label: "2. Supine to Sitting over Edge of Bed",
    grades: [
      { score: 0, desc: "Starting position: Side lying. Comes to sitting over side of bed with therapist's assistance." },
      { score: 1, desc: "Side lying to sitting over side of bed — therapist assists patient with movement throughout." },
      { score: 2, desc: "Side lying to sitting over side of bed — therapist provides assistance with legs over side of bed." },
      { score: 3, desc: "Side lying to sitting over side of bed independently." },
      { score: 4, desc: "Side lying to sitting over side of bed independently in 10 seconds." },
      { score: 5, desc: "Side lying to sitting over side of bed independently in 5 seconds." },
      { score: 6, desc: "Side lying to sitting over side of bed independently in 3 seconds." },
    ],
  },
  {
    key: "balancedSitting",
    label: "3. Balanced Sitting",
    grades: [
      { score: 0, desc: "Starting position: Sitting over edge of bed, feet on floor. Must be supervised." },
      { score: 1, desc: "Sits with some weight through affected side. Therapist assists balance." },
      { score: 2, desc: "Sits unsupported for 10 seconds without holding on." },
      { score: 3, desc: "Sits unsupported, picks up small object from floor and returns to start position." },
      { score: 4, desc: "Sits unsupported, turns to look behind over unaffected shoulder, then affected shoulder. Returns to start." },
      { score: 5, desc: "Sitting, lifts both arms above head 10 times." },
      { score: 6, desc: "Sitting, reaches forward, picks up object from floor and returns to start." },
    ],
  },
  {
    key: "sittingToStanding",
    label: "4. Sitting to Standing",
    grades: [
      { score: 0, desc: "Starting position: Sitting over edge of bed. Gets to standing with therapist's assistance." },
      { score: 1, desc: "Gets to standing with therapist providing assistance." },
      { score: 2, desc: "Gets to standing. Uses hands to support self. Weight distributed unevenly." },
      { score: 3, desc: "Gets to standing. Does not use hands. Weight distributed evenly." },
      { score: 4, desc: "Gets to standing and maintains standing position for 5 seconds with knees and hips extended." },
      { score: 5, desc: "Sitting to standing and return to sitting in 10 seconds, 3 times." },
      { score: 6, desc: "Sitting to standing and return to sitting in 5 seconds, 3 times." },
    ],
  },
  {
    key: "walking",
    label: "5. Walking",
    grades: [
      { score: 0, desc: "Stands on affected side, therapist assists with weight bearing and balance." },
      { score: 1, desc: "Walks with therapist support." },
      { score: 2, desc: "Walks with continuous physical support of one person who assists with weight bearing and balance." },
      { score: 3, desc: "Walks independently but uses an aid. No physical support required." },
      { score: 4, desc: "Walks independently without aid for 10 meters (33 feet) in 4 seconds." },
      { score: 5, desc: "Walks 10 meters, picks up a small sandbag from floor, turns and carries it back in 25 seconds." },
      { score: 6, desc: "Walks up and down 4 steps without rail 3 times in 35 seconds." },
    ],
  },
  {
    key: "upperArmFunction",
    label: "6. Upper Arm Function",
    grades: [
      { score: 0, desc: "Starting position: Sitting, arm resting on table. Raises affected arm to opposite shoulder." },
      { score: 1, desc: "Therapist places arm in position. Patient maintains position for 2 seconds." },
      { score: 2, desc: "Therapist places arm. Patient maintains for 10 seconds. Does not support with other hand." },
      { score: 3, desc: "Patient holds arm above head for 2 seconds (shoulder at 90°)." },
      { score: 4, desc: "Patient raises arm to above head, elbows straight, for 10 seconds." },
      { score: 5, desc: "Patient raises arm above head then lowers to touch top of head 10 times." },
      { score: 6, desc: "Patient raises arm above head using both arms — raises affected arm independently." },
    ],
  },
  {
    key: "handMovements",
    label: "7. Hand Movements",
    grades: [
      { score: 0, desc: "Starting position: Forearm resting on table. Wrist extension: patient moves wrist to neutral." },
      { score: 1, desc: "Clinician places wrist in extension. Patient holds position for 2 seconds." },
      { score: 2, desc: "Patient extends wrist at least 15°." },
      { score: 3, desc: "Patient extends wrist with elbow at 90° in 3 directions (flexion, extension, mid-position)." },
      { score: 4, desc: "Patient pronates/supinates forearm and extends wrist in all 3 positions." },
      { score: 5, desc: "Patient uses fingers to press buttons (3 buttons, 14 seconds)." },
      { score: 6, desc: "Patient picks up small objects one at a time with pincer grip." },
    ],
  },
  {
    key: "handActivities",
    label: "8. Advanced Hand Activities",
    grades: [
      { score: 0, desc: "Starting position: Arm at side. Picks up large ball with both hands and places on table." },
      { score: 1, desc: "Uses affected hand as assist, picks up large ball and places to side." },
      { score: 2, desc: "Picks up tennis ball from table with thumb and fingers. No pronation." },
      { score: 3, desc: "Picks up ball — brings to mouth." },
      { score: 4, desc: "Picks up ball, places at specific location (15 cm in front)." },
      { score: 5, desc: "Draws horizontal lines to stop a vertical line 10 times in 20 seconds." },
      { score: 6, desc: "Holds pencil, draws continuous circles around dots on paper." },
    ],
  },
]);

export const PROM_NEURO_RIVERMEAD_RMI_TASKS = deepFreeze([
  { id: 1, name: "Turning in Bed", description: "Can client turn in bed unaided?" },
  { id: 2, name: "Lying to Sitting", description: "Can client lie to sitting unaided?" },
  { id: 3, name: "Sitting Balance (Unsupported)", description: "Can client sit unsupported for 5 seconds?" },
  { id: 4, name: "Sitting to Standing", description: "Can client sit to stand unaided?" },
  { id: 5, name: "Standing Balance (Unsupported)", description: "Can client stand unsupported for 5 seconds?" },
  { id: 6, name: "Standing Balance (Eyes Closed)", description: "Can client stand with eyes closed for 3 seconds?" },
  { id: 7, name: "Standing to Sitting", description: "Can client stand to sit safely?" },
  { id: 8, name: "Transfer: Bed to Chair", description: "Can client transfer from bed to chair?" },
  { id: 9, name: "Transfer: Chair to Toilet", description: "Can client transfer to toilet?" },
  { id: 10, name: "Walking (Indoors) on Level Surface", description: "Can client walk 10m on level surface?" },
  { id: 11, name: "Walking (Outdoors) on Level Surface", description: "Can client walk outdoors?" },
  { id: 12, name: "Walking Up Stairs", description: "Can client walk up stairs?" },
  { id: 13, name: "Walking Down Stairs", description: "Can client walk down stairs?" },
  { id: 14, name: "Walking (Carpet or Uneven)", description: "Can client walk on carpet/uneven surfaces?" },
  { id: 15, name: "Walking (Outdoor Terrain)", description: "Can client walk on outdoor terrain?" },
]);

export const PROM_NEURO_ROLAND_STATEMENTS = deepFreeze([
  "Because of my back (or leg) pain, I am unable to care for myself without my partner's help.",
  "Because of my back (or leg) pain, I am limited in my work or other regular daily activities.",
  "Because of my back (or leg) pain, I try to handle my back (leg) pain by treating it myself, without seeing a doctor.",
  "Because of my back (or leg) pain, I get less sleep than usual.",
  "Because of my back (or leg) pain, I rest more often during the day than usual.",
  "Because of my back (or leg) pain, some of my home responsibilities are not being done.",
  "Because of my back (or leg) pain, I am more irritable and bad tempered with people than usual.",
  "Because of my back (or leg) pain, I find it difficult to get into or out of bed.",
  "Because of my back (or leg) pain, I walk more slowly than usual.",
  "Because of my back (or leg) pain, I do not do any of the jobs that I usually do around the house.",
  "Because of my back (or leg) pain, I am more confined to my chair.",
  "Because of my back (or leg) pain, I only stand for short periods of time.",
  "Because of my back (or leg) pain, I try not to bend or kneel down.",
  "Because of my back (or leg) pain, I find it difficult to get out of a chair.",
  "Because of my back (or leg) pain, my appetite is not very good.",
  "Because of my back (or leg) pain, I have trouble putting on my shoes or socks.",
  "Because of my back (or leg) pain, I only walk short distances.",
  "Because of my back (or leg) pain, I sleep in a different room than usual.",
  "Because of my back (or leg) pain, most of the time my back is painful.",
  "Because of my back (or leg) pain, I change position frequently to try to get my back comfortable.",
  "Because of my back (or leg) pain, I am afraid that I might fall in the bathroom.",
  "Because of my back (or leg) pain, I use a handrail to get upstairs.",
  "Because of my back (or leg) pain, I hold on to something to get off a toilet.",
  "Because of my back (or leg) pain, I am afraid I might fall at home, even if I try to be careful.",
]);

export const PROM_NEURO_DASH_DASH_QUESTIONS = deepFreeze([
  // Section A: Physical Function (items 1-21)
  { text: "Open a tight or new jar", section: "A" },
  { text: "Write", section: "A" },
  { text: "Turn a key", section: "A" },
  { text: "Prepare a meal", section: "A" },
  { text: "Push open a heavy door", section: "A" },
  { text: "Place an object on a shelf above your head", section: "A" },
  { text: "Do heavy household chores (e.g., wash walls, wash floors)", section: "A" },
  { text: "Garden or do yard work", section: "A" },
  { text: "Make a bed", section: "A" },
  { text: "Carry a shopping bag or briefcase", section: "A" },
  { text: "Carry a heavy object (over 5 lbs)", section: "A" },
  { text: "Change a lightbulb overhead", section: "A" },
  { text: "Wash or blow dry your hair", section: "A" },
  { text: "Wash your back", section: "A" },
  { text: "Put on a pullover sweater", section: "A" },
  { text: "Use a knife to cut food", section: "A" },
  { text: "Recreational activities which require little effort (e.g., cardplaying, knitting)", section: "A" },
  { text: "Recreational activities in which you take some force or impact through your arm, shoulder or hand (e.g., golf, hammering, tennis)", section: "A" },
  { text: "Recreational activities in which you move your arm freely (e.g., playing frisbee, badminton)", section: "A" },
  { text: "Manage transportation needs (getting from one place to another)", section: "A" },
  { text: "Sexual activities", section: "A" },
  // Section B: Symptoms (items 22-30)
  { text: "During the past week, to what extent has your arm, shoulder or hand problem interfered with your normal social activities with family, friends, neighbours or groups?", section: "B" },
  { text: "During the past week, were you limited in your work or other regular daily activities as a result of your arm, shoulder or hand problem?", section: "B" },
  { text: "Arm, shoulder or hand pain", section: "B_symptom" },
  { text: "Arm, shoulder or hand pain when you performed any specific activity", section: "B_symptom" },
  { text: "Tingling (pins and needles) in your arm, shoulder or hand", section: "B_symptom" },
  { text: "Weakness in your arm, shoulder or hand", section: "B_symptom" },
  { text: "Stiffness in your arm, shoulder or hand", section: "B_symptom" },
  { text: "During the past week, how much difficulty have you had sleeping due to the pain in your arm, shoulder or hand?", section: "B_sleep" },
  { text: "I feel less capable, less confident or less useful because of my arm, shoulder or hand problem", section: "B_psych" },
]);

export const PROM_NEURO_DASH_OPTION_SETS = deepFreeze({
  A: [
    { label: "No difficulty", value: 1 },
    { label: "Mild difficulty", value: 2 },
    { label: "Moderate difficulty", value: 3 },
    { label: "Severe difficulty", value: 4 },
    { label: "Unable", value: 5 },
  ],
  B: [
    { label: "Not at all", value: 1 },
    { label: "Slightly", value: 2 },
    { label: "Moderately", value: 3 },
    { label: "Quite a bit", value: 4 },
    { label: "Extremely", value: 5 },
  ],
  B_symptom: [
    { label: "None", value: 1 },
    { label: "Mild", value: 2 },
    { label: "Moderate", value: 3 },
    { label: "Severe", value: 4 },
    { label: "Extreme", value: 5 },
  ],
  B_sleep: [
    { label: "No difficulty", value: 1 },
    { label: "Mild difficulty", value: 2 },
    { label: "Moderate difficulty", value: 3 },
    { label: "Severe difficulty", value: 4 },
    { label: "So much difficulty it prevented sleep", value: 5 },
  ],
  B_psych: [
    { label: "Strongly disagree", value: 1 },
    { label: "Disagree", value: 2 },
    { label: "Neither agree nor disagree", value: 3 },
    { label: "Agree", value: 4 },
    { label: "Strongly agree", value: 5 },
  ],
});

export const PROM_NEURO_FAAM_ADL_ITEMS = deepFreeze([
  "Standing",
  "Walking on even ground",
  "Walking on even ground without shoes",
  "Walking up hills",
  "Walking down hills",
  "Going up stairs",
  "Going down stairs",
  "Walking on uneven ground",
  "Stepping up and down curbs",
  "Squatting",
  "Coming up on your toes",
  "Walking initially",
  "Walking 5 minutes or less",
  "Walking 10 minutes",
  "Walking 15 minutes or greater",
  "Home responsibilities",
  "Activities of daily living",
  "Personal care",
  "Light to moderate work (standing, walking)",
  "Heavy work (push/pulling, climbing, carrying)",
  "Recreational activities",
]);

export const PROM_NEURO_FAAM_SPORTS_ITEMS = deepFreeze([
  "Running",
  "Jumping",
  "Landing",
  "Starting and stopping quickly",
  "Cutting/lateral movements",
  "Low impact activities",
  "Ability to perform activity with normal technique",
  "Ability to participate in desired sport as long as you would like",
]);

export const PROM_NEURO_FAAM_SCORE_OPTIONS = deepFreeze([
  { value: 4, label: "4 – No difficulty" },
  { value: 3, label: "3 – Slight difficulty" },
  { value: 2, label: "2 – Moderate difficulty" },
  { value: 1, label: "1 – Extreme difficulty" },
  { value: 0, label: "0 – Unable to do" },
]);

export const PROM_NEURO_IKDC_IKDC_QUESTIONS = deepFreeze([
  // SYMPTOMS SUBSCALE (5 items)
  { id: 'q1_pain', label: 'What is the highest level of activity you can perform without significant knee pain?', max: 10, subscale: 'Symptoms', anchors: { 0: 'Unable', 5: 'Moderate', 10: 'Very high activity' } },
  { id: 'q2_stiffness', label: 'During the past 4 weeks, how stiff or swollen was your knee?', max: 4, subscale: 'Symptoms', anchors: { 0: 'Not stiff/swollen', 2: 'Moderately stiff/swollen', 4: 'Very stiff/swollen' } },
  { id: 'q3_swelling', label: 'What is the highest level of activity you can perform without significant swelling?', max: 10, subscale: 'Symptoms', anchors: { 0: 'Unable', 5: 'Moderate', 10: 'Very high activity' } },
  { id: 'q4_lock_catch', label: 'Does your knee lock or catch?', max: 2, subscale: 'Symptoms', anchors: { 0: 'Yes, frequently', 1: 'Occasionally', 2: 'No, never' } },
  { id: 'q5_giving_way', label: 'What is the highest level of activity you can perform without significant giving way?', max: 10, subscale: 'Symptoms', anchors: { 0: 'Unable', 5: 'Moderate', 10: 'Very high activity' } },
  // FUNCTION SUBSCALE (9 items)
  { id: 'q6_stairs_up', label: 'How difficult is it to go up stairs?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q7_stairs_down', label: 'How difficult is it to go down stairs?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q8_kneel', label: 'How difficult is it to kneel on the front of your knee?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q9_squat', label: 'How difficult is it to squat?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q10_sit_bent', label: 'How difficult is it to sit with your knee bent?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q11_rise_chair', label: 'How difficult is it to rise from a chair?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q12_run_straight', label: 'How difficult is it to run straight ahead?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q13_jump_land', label: 'How difficult is it to jump and land on your involved leg?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q14_stop_quickly', label: 'How difficult is it to stop and start quickly?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
]);

export const PROM_NEURO_CAT_QUESTIONS = deepFreeze([
  { key: "cough", text: "Cough", anchorLeft: "I never cough", anchorRight: "I cough all the time" },
  { key: "phlegm", text: "Phlegm", anchorLeft: "I have no phlegm (mucus) in my chest at all", anchorRight: "My chest is completely full of phlegm (mucus)" },
  { key: "chestTightness", text: "Chest tightness", anchorLeft: "My chest does not feel tight at all", anchorRight: "My chest feels very tight" },
  { key: "breathlessness", text: "Breathlessness", anchorLeft: "When I walk up a hill or one flight of stairs I am not breathless", anchorRight: "When I walk up a hill or one flight of stairs I am very breathless" },
  { key: "activities", text: "Activity limitation", anchorLeft: "I am not limited doing any activities at home", anchorRight: "I am very limited doing activities at home" },
  { key: "confidence", text: "Confidence leaving home", anchorLeft: "I am confident leaving my home despite my lung condition", anchorRight: "I am not at all confident leaving my home because of my lung condition" },
  { key: "sleep", text: "Sleep", anchorLeft: "I sleep soundly", anchorRight: "I don't sleep soundly because of my lung condition" },
  { key: "energy", text: "Energy", anchorLeft: "I have lots of energy", anchorRight: "I have no energy at all" },
]);

export const PROM_NEURO_CCQ_DOMAINS = deepFreeze([
  {
    label: "Symptoms (S)",
    items: [
      { id: 0, text: "On average, during the past week, how often did you feel short of breath at rest?" },
      { id: 1, text: "On average, during the past week, how often did you feel short of breath doing physical activities?" },
      { id: 2, text: "On average, during the past week, how often did you cough?" },
      { id: 3, text: "On average, during the past week, how often did you produce phlegm?" },
    ],
    color: "border-blue-200 bg-blue-50/30",
  },
  {
    label: "Functional State (F)",
    items: [
      { id: 4, text: "On average, during the past week, how limited were you in strenuous activities (e.g. climbing stairs, hurrying, sports)?" },
      { id: 5, text: "On average, during the past week, how limited were you in moderate activities (e.g. walking, housework, carrying things)?" },
      { id: 6, text: "On average, during the past week, how limited were you in daily activities at home (e.g. dressing, washing)?" },
    ],
    color: "border-green-200 bg-green-50/30",
  },
  {
    label: "Mental State (M)",
    items: [
      { id: 7, text: "On average, during the past week, how often did you feel concerned about getting a cold or your breathing getting worse?" },
      { id: 8, text: "On average, during the past week, how often did you feel depressed (down) because of your breathing problems?" },
      { id: 9, text: "On average, during the past week, how often did you feel worried about your breathing?" },
    ],
    color: "border-purple-200 bg-purple-50/30",
  },
]);

export const PROM_NEURO_CCQ_OPTIONS = deepFreeze([
  { value: 0, label: "0 – Never/Not limited at all" },
  { value: 1, label: "1 – Hardly ever/Hardly limited" },
  { value: 2, label: "2 – A few times/A little limited" },
  { value: 3, label: "3 – Several times/Moderately limited" },
  { value: 4, label: "4 – Many times/Very limited" },
  { value: 5, label: "5 – A great many times/Extremely limited" },
  { value: 6, label: "6 – Almost always/Unable to do" },
]);

export const PROM_NEURO_LCQ_LCQ_DOMAINS = deepFreeze([
  {
    key: "physical",
    label: "Physical Domain",
    color: "red",
    items: [
      { id: "P1", text: "I have been coughing a lot." },
      { id: "P2", text: "I have been bothered by coughing when I exercise." },
      { id: "P3", text: "I have had chest or stomach pains due to coughing." },
      { id: "P4", text: "I have been tired because of my cough." },
      { id: "P5", text: "My cough has made me hoarse." },
      { id: "P6", text: "My cough has made me feel short of breath." },
      { id: "P7", text: "I have been incontinent due to coughing." },
    ],
  },
  {
    key: "psychological",
    label: "Psychological Domain",
    color: "purple",
    items: [
      { id: "Ps1", text: "I have been embarrassed by my coughing." },
      { id: "Ps2", text: "My cough has made me feel anxious." },
      { id: "Ps3", text: "My cough has made me feel frustrated." },
      { id: "Ps4", text: "I have felt fed up with my cough." },
      { id: "Ps5", text: "I have been bothered by coughing when talking to people." },
      { id: "Ps6", text: "I have felt in control of my cough." },
    ],
  },
  {
    key: "social",
    label: "Social Domain",
    color: "blue",
    items: [
      { id: "S1", text: "My cough has interfered with my job or other daily tasks." },
      { id: "S2", text: "My cough has disturbed my sleep." },
      { id: "S3", text: "My cough has caused problems with family, friends or other people." },
      { id: "S4", text: "My cough has affected my social life." },
      { id: "S5", text: "My cough has affected my enjoyment of social activities." },
      { id: "S6", text: "My cough has made me feel I am a burden to others." },
    ],
  },
]);

export const PROM_NEURO_LCQ_SCALE = deepFreeze([
  { value: 7, label: "Always" },
  { value: 6, label: "Most of the time" },
  { value: 5, label: "A good bit of the time" },
  { value: 4, label: "Some of the time" },
  { value: 3, label: "A little of the time" },
  { value: 2, label: "Hardly any of the time" },
  { value: 1, label: "None of the time" },
]);

export const PROM_NEURO_LCQ_DOMAINCOLORMAP = deepFreeze({
  red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", badge: "bg-red-100 text-red-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800", badge: "bg-purple-100 text-purple-700" },
  blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", badge: "bg-blue-100 text-blue-700" },
});

export const PROM_NEURO_CBM_TASKS = deepFreeze([
  {
    name: "Unilateral Stance",
    description: "Stand on one leg on a foam surface. Eyes open. Score based on duration and quality.",
    scoring: "0=Unable, 1=<5s, 2=5–10s, 3=10–20s, 4=20–30s with difficulty, 5=30s stable",
  },
  {
    name: "Tandem Walking",
    description: "Walk heel-to-toe along a 3m line. 10 steps total.",
    scoring: "0=Unable, 1=≥4 steps off, 2=2–3 steps off, 3=1 step off, 4=Completed with arm raise, 5=Perfect",
  },
  {
    name: "180° Tandem Pivot",
    description: "Turn 180° using small steps while maintaining tandem stance.",
    scoring: "0=Unable, 1=Major difficulty, 2=Loses tandem 2+, 3=Loses tandem once, 4=Completed slowly, 5=Smooth and controlled",
  },
  {
    name: "Lateral Foot Scooting",
    description: "Sidestep 3m to the right, then 3m to left as fast as possible without crossing feet.",
    scoring: "0=Unable, 2=Crosses feet or uses support, 3=Slow/hesitant, 4=Adequate speed with minor error, 5=Fast and controlled",
  },
  {
    name: "Hopping Forward",
    description: "Hop forward on one foot for 2m. Repeated on other foot.",
    scoring: "0=Unable, 1=1–2 hops only, 2=<1m, 3=1–2m with difficulty, 4=2m with arm use, 5=2m controlled",
  },
  {
    name: "Crouch and Walk",
    description: "Walk 3m in a crouched position (knees bent ~45°), return to start.",
    scoring: "0=Unable, 1=Falls or uses support, 2=Cannot maintain crouch, 3=Crouch inconsistent, 4=Completed slowly, 5=Fluid and controlled",
  },
  {
    name: "Lateral Dodging",
    description: "Walk forward, dodge around 3 cones placed 1m apart.",
    scoring: "0=Unable, 1=Hits ≥2 cones, 2=Hits 1 cone, 3=Avoids but slow, 4=Adequate with minor imbalance, 5=Smooth and fast",
  },
  {
    name: "Walking and Looking",
    description: "Walk 6m while turning head left/right every 2 steps.",
    scoring: "0=Unable, 2=Stops or grabs support, 3=Veers or slows significantly, 4=Minor deviation, 5=Smooth gaze with stable gait",
  },
  {
    name: "Running with Controlled Stop",
    description: "Run 6m and stop within 1m of a marked line on command.",
    scoring: "0=Unable/refuses, 1=Cannot run, 2=Overshoots >1m, 3=Overshoots slightly, 4=Stops within 1m awkwardly, 5=Controlled stop",
  },
  {
    name: "Forward to Backward Walking",
    description: "Walk forward 3m, then backward 3m on command.",
    scoring: "0=Unable, 1=Cannot walk backward, 2=Loses balance, 3=Very slow, 4=Adequate with hesitation, 5=Smooth transition",
  },
  {
    name: "Walk, Look, and Carry",
    description: "Walk 6m while carrying a tray with cups and looking at the cups.",
    scoring: "0=Unable, 1=Drops tray/cups, 2=Spills or veers significantly, 3=Spills minor amount, 4=Slow and careful, 5=Controlled and efficient",
  },
  {
    name: "Descending Stairs",
    description: "Descend a full flight of stairs without rail if possible. Score for safety and efficiency.",
    scoring: "0=Unable, 1=Requires physical assist, 2=Requires rail both directions, 3=Requires rail one direction, 4=Slow without rail, 5=Normal speed without rail",
  },
  {
    name: "Step-Ups",
    description: "Step up and down from a 20cm step as fast as possible 5 times each leg.",
    scoring: "0=Unable, 1=Requires support, 2=Very slow or unstable, 3=Slow but independent, 4=Adequate speed with minor difficulty, 5=Fast and controlled",
  },
]);

export const PROM_NEURO_FESI_FESI_ACTIVITIES = deepFreeze([
  "Cleaning the house",
  "Getting dressed or undressed",
  "Preparing simple meals",
  "Taking a bath or shower",
  "Going to the shop",
  "Getting in or out of a chair",
  "Going up or down stairs",
  "Walking around in the neighborhood",
  "Reaching for something above your head or on the ground",
  "Going to answer the telephone before it stops ringing",
  "Walking on a slippery surface",
  "Visiting a friend or relative",
  "Walking in a place with crowds",
  "Walking on an uneven surface",
  "Walking up or down a slope",
  "Going out to a social event",
]);

export const PROM_NEURO_FESI_CONCERN_LABELS = deepFreeze({ 1: "Not at all concerned", 2: "Somewhat concerned", 3: "Fairly concerned", 4: "Very concerned" });

export const PROM_NEURO_PCL5_PCL5_ITEMS = deepFreeze([
  { id: 1, text: "Repeated, disturbing, and unwanted memories of the stressful experience?" },
  { id: 2, text: "Repeated, disturbing dreams of the stressful experience?" },
  { id: 3, text: "Suddenly feeling or acting as if the stressful experience were happening again (as if you were reliving it)?" },
  { id: 4, text: "Feeling very upset when something reminded you of the stressful experience?" },
  { id: 5, text: "Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, sweating, or trembling)?" },
  { id: 6, text: "Avoiding memories, thoughts, or feelings related to the stressful experience?" },
  { id: 7, text: "Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)?" },
  { id: 8, text: "Trouble remembering important parts of the stressful experience?" },
  { id: 9, text: "Having strong negative beliefs about yourself, other people, or the world (for example, having thoughts such as: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)?" },
  { id: 10, text: "Blaming yourself or the other person for the stressful experience or what happened after it?" },
  { id: 11, text: "Having strong negative feelings such as fear, anger, guilt, or shame?" },
  { id: 12, text: "Loss of interest in activities that you used to enjoy?" },
  { id: 13, text: "Feeling distant or cut off from other people?" },
  { id: 14, text: "Trouble experiencing positive emotions (for example, you were unable to feel happiness or have loving feelings for people close to you)?" },
  { id: 15, text: "Irritable behavior, angry outbursts, or acting aggressively?" },
  { id: 16, text: "Taking too many risks or doing things that could cause you harm?" },
  { id: 17, text: "Being \"on guard\" or watchful or suspicious of others around you?" },
  { id: 18, text: "Trouble concentrating?" },
  { id: 19, text: "Trouble falling or staying asleep?" },
  { id: 20, text: "Trouble controlling your temper?" },
]);

export const PROM_NEURO_PCL5_RESPONSE_OPTIONS = deepFreeze([
  { value: 0, label: "Not at all" },
  { value: 1, label: "A little bit" },
  { value: 2, label: "Moderately" },
  { value: 3, label: "Quite a bit" },
  { value: 4, label: "Extremely" },
]);

export const PROM_NEURO_ISI_QUESTIONS = deepFreeze([
  {
    number: 1,
    text: "Difficulty falling asleep",
    subscale: "Initiation"
  },
  {
    number: 2,
    text: "Difficulty staying asleep (frequent awakenings or long periods awake)",
    subscale: "Maintenance"
  },
  {
    number: 3,
    text: "Problem waking up too early in the morning",
    subscale: "Maintenance"
  },
  {
    number: 4,
    text: "Satisfaction with current sleep pattern",
    subscale: "Satisfaction (Reverse)"
  },
  {
    number: 5,
    text: "Noticeability of impairment in daytime functioning due to sleep problem",
    subscale: "Daytime Impairment"
  },
  {
    number: 6,
    text: "Worry or distress caused by the sleep problem",
    subscale: "Concern"
  },
  {
    number: 7,
    text: "Interference with quality of life caused by the sleep problem",
    subscale: "Daytime Impairment"
  }
]);

export const PROM_NEURO_PPT_TASKS = deepFreeze({
  "7-item": [
    { id: "task_1_sentence", name: "Writing a sentence", number: 1 },
    { id: "task_2_eating", name: "Simulated eating", number: 2 },
    { id: "task_3_book_lift", name: "Lifting a book overhead", number: 3 },
    { id: "task_4_jacket", name: "Putting on and removing a jacket", number: 4 },
    { id: "task_5_pickup", name: "Picking up a small object from the floor", number: 5 },
    { id: "task_6_turn", name: "Turning 360 degrees", number: 6 },
    { id: "task_7_walk", name: "50-foot (15 m) walk test", number: 7 },
  ],
  "9-item": [
    { id: "task_1_sentence", name: "Writing a sentence", number: 1 },
    { id: "task_2_eating", name: "Simulated eating", number: 2 },
    { id: "task_3_book_lift", name: "Lifting a book overhead", number: 3 },
    { id: "task_4_jacket", name: "Putting on and removing a jacket", number: 4 },
    { id: "task_5_pickup", name: "Picking up a small object from the floor", number: 5 },
    { id: "task_6_turn", name: "Turning 360 degrees", number: 6 },
    { id: "task_7_walk", name: "50-foot (15 m) walk test", number: 7 },
    { id: "task_8_stairs", name: "Stair task", number: 8 },
    { id: "task_9_progressive_romberg", name: "Progressive standing balance task", number: 9 },
  ],
});

export const PROM_NEURO_PPT_SAFETY_CONCERNS = deepFreeze([
  { label: "Falls risk", value: "falls_risk" },
  { label: "Pain", value: "pain" },
  { label: "Dizziness", value: "dizziness" },
  { label: "Breathlessness", value: "breathlessness" },
  { label: "Fatigue", value: "fatigue" },
  { label: "Cardiac symptoms", value: "cardiac_symptoms" },
]);

export const PROM_NEURO_BESTEST_BESTEST_SECTIONS = deepFreeze([
  {
    name: "Biomechanical Constraints",
    items: [
      "Base of support",
      "COM alignment",
      "Ankle strength & ROM",
      "Hip/trunk lateral strength",
      "Sit on floor & stand up"
    ]
  },
  {
    name: "Stability Limits/Verticality",
    items: [
      "Functional reach forward",
      "Functional reach lateral",
      "Lean to limits"
    ]
  },
  {
    name: "Anticipatory Postural Adjustments",
    items: [
      "Sit to stand",
      "Rise to toes",
      "Stand on one leg",
      "Alternate stair touching",
      "Standing arm raise"
    ]
  },
  {
    name: "Postural Responses",
    items: [
      "In-place response forward",
      "In-place response backward",
      "Compensatory step correction forward",
      "Compensatory step correction backward",
      "Compensatory step correction lateral"
    ]
  },
  {
    name: "Sensory Orientation",
    items: [
      "Stance eyes open firm surface",
      "Stance eyes closed foam surface",
      "Incline eyes closed",
      "Stance eyes open turning head horizontal",
      "Stance eyes open turning head vertical"
    ]
  },
  {
    name: "Stability in Gait",
    items: [
      "Gait level surface",
      "Change in gait speed",
      "Walk with head turns horizontal",
      "Walk with pivot turns",
      "Step over obstacles",
      "TUG with dual task"
    ]
  }
]);

export const PROM_NEURO_EMS_EMS_LABELS = deepFreeze({
    lyingToSitting: "Lying to Sitting",
    sittingToLying: "Sitting to Lying",
    sitToStand: "Sit to Stand",
    standing: "Standing",
    gait: "Gait",
    timedWalk: "Timed Walk (6 meters)",
    functionalReach: "Functional Reach",
  });

export const PROM_NEURO_EMS_EMS_SCORING = deepFreeze({
    lyingToSitting: "0=Unable without assistance, 1=Able with assistance, 2=Able with difficulty, 3=Able normally",
    sittingToLying: "0=Unable without assistance, 1=Able with assistance, 2=Able with difficulty, 3=Able normally",
    sitToStand: "0=Unable without assistance, 1=Able with assistance, 2=Able with difficulty, 3=Able normally",
    standing: "0=Unable, 1=Able with assistance, 2=Able with aid, 3=Able without aid",
    gait: "0=Unable/unsafe, 1=Assisted, 2=With difficulty, 3=Normal",
    timedWalk: "0=Unable, 1=>14 seconds, 2=10-14 seconds, 3=&lt;10 seconds",
    functionalReach: "0=Unable, 1=&lt;6 inches, 2=6-10 inches, 3=&gt;10 inches",
  });

export const PROM_NEURO_PEDIATRIC_BALANCE_ITEMS = deepFreeze([
                {
                  label: "Sitting to standing",
                  instructions: "Ask child to stand from a standard chair. Observe whether they use hands for support.",
                  criteria: ["4 – Stands without using hands, stabilises independently", "3 – Stands using hands, stabilises independently", "2 – Stands using hands after several attempts", "1 – Needs minimal assistance to stand or stabilise", "0 – Needs moderate/maximal assistance to stand"]
                },
                {
                  label: "Standing to sitting",
                  instructions: "Ask child to sit down in the chair. Observe control of the lowering movement.",
                  criteria: ["4 – Sits safely with minimal use of hands", "3 – Controls descent using hands", "2 – Uses back of legs against chair to control descent", "1 – Sits independently but uncontrolled descent", "0 – Needs assistance to sit"]
                },
                {
                  label: "Transfers",
                  instructions: "Place two chairs side-by-side (or chair + treatment table). Ask child to move from one to the other in both directions.",
                  criteria: ["4 – Transfers safely with minor hand use", "3 – Transfers safely but requires hands", "2 – Transfers with verbal cueing and/or supervision", "1 – Needs one person assistance", "0 – Needs two people to assist/supervise"]
                },
                {
                  label: "Standing unsupported",
                  instructions: "Ask child to stand still without holding anything for 1 minute (30 sec for age <5). Stand close for safety.",
                  criteria: ["4 – Stands safely for 1 minute", "3 – Stands 1 minute with supervision", "2 – Stands 30 seconds unsupported", "1 – Needs several attempts; stands 15 seconds", "0 – Unable to stand 10 seconds without support"]
                },
                {
                  label: "Sitting unsupported",
                  instructions: "Ask child to sit on chair (no back support, feet on floor) with arms folded for 1 minute.",
                  criteria: ["4 – Sits safely and securely for 1 minute", "3 – Sits 1 minute with supervision", "2 – Sits 30 seconds", "1 – Sits 10 seconds", "0 – Unable to sit without support for 10 seconds"]
                },
                {
                  label: "Standing with eyes closed",
                  instructions: "Ask child to close eyes and stand still for 10 seconds. Stand nearby for safety.",
                  criteria: ["4 – Stands 10 seconds safely", "3 – Stands 10 seconds with supervision", "2 – Stands 3 seconds", "1 – Unable to keep eyes closed 3 seconds but stays stable", "0 – Needs help to prevent falling"]
                },
                {
                  label: "Standing with feet together",
                  instructions: "Ask child to place feet together and stand without holding onto anything for 1 minute.",
                  criteria: ["4 – Places feet together independently and holds 1 minute", "3 – Places feet together and holds 1 minute with supervision", "2 – Places feet together and holds 30 seconds", "1 – Needs help to attain position but holds 15 seconds", "0 – Needs help to attain position and unable to hold for 15 seconds"]
                },
                {
                  label: "Standing with one foot in front",
                  instructions: "Demonstrate tandem stance (heel-to-toe). Ask child to place one foot directly in front of the other and hold for 30 seconds.",
                  criteria: ["4 – Places foot independently (tandem) and holds 30 seconds", "3 – Places foot independently and holds 15 seconds", "2 – Takes small step independently and holds 30 seconds", "1 – Needs help to step but holds 15 seconds", "0 – Loses balance while stepping or standing"]
                },
                {
                  label: "Standing on one foot",
                  instructions: "Ask child to lift one foot off the ground without holding onto anything and hold for as long as possible (max 10 seconds). Test each side.",
                  criteria: ["4 – Lifts leg independently and holds ≥10 seconds", "3 – Lifts leg independently and holds 5–9 seconds", "2 – Lifts leg independently and holds ≥3 seconds", "1 – Attempts to lift leg but cannot hold 3 seconds; remains standing", "0 – Unable to attempt or needs support to prevent falling"]
                },
                {
                  label: "Turning 360 degrees",
                  instructions: "Ask child to turn all the way around in a full circle, pause, then turn in the other direction.",
                  criteria: ["4 – Turns 360° safely within 4 seconds each side", "3 – Turns 360° safely one side only within 4 seconds", "2 – Turns 360° safely but slowly (>4 seconds)", "1 – Needs close supervision or verbal cueing", "0 – Needs assistance while turning"]
                },
                {
                  label: "Turning to look behind",
                  instructions: "Ask child to look behind over each shoulder by turning their head/trunk. Place an object or person behind them to encourage full rotation.",
                  criteria: ["4 – Looks behind from both sides; weight shifts well", "3 – Looks behind from one side only; less weight shift", "2 – Turns sideways only but maintains balance", "1 – Needs supervision when turning", "0 – Needs assistance to prevent loss of balance or falling"]
                },
                {
                  label: "Retrieving object from floor",
                  instructions: "Place a small object (e.g., shoe, beanbag) on the floor in front of the child's feet. Ask them to pick it up.",
                  criteria: ["4 – Retrieves object safely and easily", "3 – Retrieves object but needs supervision", "2 – Unable to retrieve but reaches 2–5 cm from object and keeps balance", "1 – Unable to retrieve; needs supervision while trying", "0 – Unable to attempt or needs assistance to prevent falling"]
                },
                {
                  label: "Placing alternate foot on stool",
                  instructions: "Ask child to place each foot alternately on a step stool (8 inches high). Complete 8 total touches (4 each foot). Time the task.",
                  criteria: ["4 – Stands independently and completes 8 steps within 20 seconds", "3 – Stands independently and completes 8 steps in >20 seconds", "2 – Completes 4 steps without aids with supervision", "1 – Completes >2 steps; needs minimal assistance", "0 – Needs assistance to prevent falling or unable to try"]
                },
                {
                  label: "Reaching forward with outstretched arm",
                  instructions: "Ask child to raise arm to 90° and reach forward as far as possible without stepping. Measure distance from fingertip at start vs end.",
                  criteria: ["4 – Reaches forward confidently >25 cm", "3 – Reaches >12 cm safely", "2 – Reaches >5 cm safely", "1 – Reaches forward but needs supervision", "0 – Loses balance or requires external support"]
                },
              ]);

export const PROM_NEURO_GAS_ATTAINMENT_OPTIONS = deepFreeze([
  { value: -2, label: 'Much less than expected' },
  { value: -1, label: 'Somewhat less than expected' },
  { value: 0, label: 'Expected outcome' },
  { value: 1, label: 'Somewhat more than expected' },
  { value: 2, label: 'Much more than expected' },
]);

export const PROM_NEURO_PSFS_SCORE_OPTIONS = deepFreeze(Array.from({ length: 11 }, (_, value) => value));
export const PROM_NEURO_PASE_YES_NO_OPTIONS = deepFreeze(['Yes', 'No']);
export const PROM_NEURO_PASE_WORK_TYPE_OPTIONS = deepFreeze(['Mostly sitting', 'Mostly standing/walking', 'Physical labour']);

const ROUTES = [
  ['odi', 'Oswestry Disability Index', 'questionnaire', 'section_scores', '%', 'sum-sections-then-percent'],
  ['fma', 'Fugl-Meyer Assessment', 'measurement', 'item_scores', 'points', 'sum-validated-item-scores'],
  ['sarc_f', 'SARC-F', 'questionnaire', 'total_score', 'points', 'sum-five-items'],
  ['ndi', 'Neck Disability Index', 'questionnaire', 'percentage', '%', 'sum-sections-then-percent'],
  ['k10_full', 'Kessler Psychological Distress Scale K10', 'questionnaire', 'total_score', 'points', 'sum-ten-items'],
  ['hoos_full', 'Hip disability and Osteoarthritis Outcome Score', 'questionnaire', 'average_score', '/100', 'five-normalised-subscale-average'],
  ['koos_full', 'Knee injury and Osteoarthritis Outcome Score', 'questionnaire', 'average_score', '/100', 'five-normalised-subscale-average'],
  ['fiqr', 'Fibromyalgia Impact Questionnaire Revised', 'questionnaire', 'total_score', '/100', 'weighted-three-domain-sum'],
  ['wpi', 'Widespread Pain Index and Symptom Severity Scale', 'questionnaire', 'total_score', '/31', 'wpi-plus-sss'],
  ['pcs', 'Pain Catastrophizing Scale', 'questionnaire', 'total_score', '/52', 'sum-thirteen-items'],
  ['dsq2', 'DePaul Symptom Questionnaire 2', 'questionnaire', 'composite_score', 'ratio', 'frequency-severity-composite'],
  ['chalder_fatigue', 'Chalder Fatigue Scale', 'questionnaire', 'bimodal_score', '/11', 'bimodal-eleven-item-sum'],
  ['sf36', 'SF-36 Health Survey', 'questionnaire', 'physical_component_summary', '/100', 'domain-normalisation-and-component-means'],
  ['fss', 'Fatigue Severity Scale', 'questionnaire', 'mean_score', '/7', 'mean-nine-items'],
  ['promis_fatigue', 'PROMIS Fatigue Short Form 8a', 'measurement', 't_score', 'T-score', 'raw-score-lookup-or-explicit-t-score'],
  ['psqi', 'Pittsburgh Sleep Quality Index', 'questionnaire', 'global_score', '/21', 'sum-seven-components'],
  ['dgi_full', 'Dynamic Gait Index', 'measurement', 'total_score', '/24', 'sum-eight-tasks'],
  ['fga', 'Functional Gait Assessment', 'measurement', 'total_score', '/30', 'sum-ten-items'],
  ['parq', 'Physical Activity Readiness Questionnaire', 'questionnaire', 'yes_count', '/7', 'count-yes-responses'],
  ['gas', 'Goal Attainment Scaling', 'measurement', 'weighted_attainment', 'weighted points', 'attainment-times-importance-plus-difficulty'],
  ['psfs', 'Patient-Specific Functional Scale', 'measurement', 'mean_score', '/10', 'mean-named-activity-score'],
  ['lefs', 'Lower Extremity Functional Scale', 'questionnaire', 'total_score', '/80', 'sum-twenty-items'],
  ['himat_full', 'High-Level Mobility Assessment Tool', 'measurement', 'total_score', '/54', 'sum-ten-task-scores'],
  ['aqol', 'Assessment of Quality of Life 4D', 'questionnaire', 'total_score', '/36', 'sum-twelve-items'],
  ['spadi', 'Shoulder Pain and Disability Index', 'questionnaire', 'total_score', '%', 'mean-normalised-subscales'],
  ['breq', 'Behavioural Regulation in Exercise Questionnaire 2', 'questionnaire', 'relative_autonomy_index', 'RAI', 'weighted-subscale-means'],
  ['pase', 'Physical Activity Scale for the Elderly', 'questionnaire', 'total_score', 'points', 'weighted-leisure-household-work-sum'],
  ['qbpds', 'Quebec Back Pain Disability Scale', 'measurement', 'total_score', '/100', 'validated-entered-total'],
  ['womac', 'WOMAC Osteoarthritis Index', 'questionnaire', 'total_score', '/96', 'sum-twenty-four-items'],
  ['stroop', 'Stroop Test', 'measurement', 'interference_trial_time', 'seconds', 'trial-rate-and-golden-interference'],
  ['digit_span', 'Digit Span Test', 'measurement', 'forward_max', 'digits', 'longest-correct-forward-span'],
  ['mas', 'Modified Ashworth Scale', 'measurement', 'muscles_assessed', 'muscles', 'validated-muscle-assessment-count'],
  ['tardieu', 'Tardieu Scale', 'measurement', 'primary_r2_minus_r1', 'degrees', 'primary-r2-minus-r1'],
  ['barthel', 'Barthel Index', 'questionnaire', 'total_score', '/100', 'sum-ten-weighted-items'],
  ['abc_scale', 'Activities-specific Balance Confidence Scale', 'questionnaire', 'mean_score', '%', 'mean-sixteen-confidence-ratings'],
  ['mas_stroke', 'Motor Assessment Scale for Stroke', 'measurement', 'total_score', '/48', 'sum-eight-items'],
  ['rivermead_mobility', 'Rivermead Mobility Index', 'measurement', 'total_score', '/15', 'sum-fifteen-binary-items'],
  ['roland', 'Roland-Morris Disability Questionnaire', 'questionnaire', 'total_score', '/24', 'count-checked-items'],
  ['dash', 'Disabilities of the Arm Shoulder and Hand', 'questionnaire', 'dash_score', '/100', 'thirty-item-dash-transform'],
  ['faam', 'Foot and Ankle Ability Measure', 'questionnaire', 'adl_score', '%', 'valid-item-normalised-subscales'],
  ['ikdc', 'IKDC Subjective Knee Evaluation', 'questionnaire', 'score_percent', '%', 'sum-divided-by-maximum-possible'],
  ['cat', 'COPD Assessment Test', 'questionnaire', 'total_score', '/40', 'sum-eight-items'],
  ['ccq', 'Clinical COPD Questionnaire', 'questionnaire', 'total_mean', '/6', 'mean-ten-items'],
  ['lcq', 'Leicester Cough Questionnaire', 'questionnaire', 'total_mean', '/7', 'mean-nineteen-items'],
  ['cbm_full', 'Community Balance and Mobility Scale', 'measurement', 'total_score', '/65', 'sum-thirteen-tasks'],
  ['bestest_full', 'Balance Evaluation Systems Test', 'measurement', 'total_score', '/108', 'sum-twenty-nine-items'],
  ['fesi', 'Falls Efficacy Scale International', 'questionnaire', 'total_score', '/64', 'sum-sixteen-items'],
  ['ems_full', 'Elderly Mobility Scale', 'measurement', 'total_score', '/20', 'sum-seven-items'],
  ['pcl5', 'PTSD Checklist for DSM-5', 'questionnaire', 'total_score', '/80', 'sum-twenty-items'],
  ['isi', 'Insomnia Severity Index', 'questionnaire', 'total_score', '/28', 'sum-seven-items'],
  ['pediatric_balance', 'Pediatric Balance Scale', 'measurement', 'total_score', '/56', 'sum-fourteen-items'],
  ['ppt_full', 'Physical Performance Test', 'measurement', 'total_score', 'points', 'sum-versioned-task-scores'],
  ['phq9_full', 'Patient Health Questionnaire 9', 'questionnaire', 'total_score', '/27', 'sum-nine-items'],
  ['gad7_full', 'Generalized Anxiety Disorder 7', 'questionnaire', 'total_score', '/21', 'sum-seven-items'],
];

export const PROM_NEURO_RUNNER_KEYS = Object.freeze(ROUTES.map(([runnerKey]) => runnerKey));


const contentOption = (label, value) => ({ label: String(label), value });
const contentOptions = (options, start = 0) => options.map((entry, index) => (
  entry && typeof entry === 'object' && !Array.isArray(entry)
    ? contentOption(entry.label ?? entry.text ?? entry.desc ?? String(entry.value), entry.value ?? entry.score ?? index + start)
    : contentOption(entry, index + start)
));
const scoreContentOptions = (min, max, labels = {}) => Array.from(
  { length: max - min + 1 },
  (_, index) => {
    const value = min + index;
    return contentOption(labels[value] ?? String(value), value);
  },
);
const itemIdentity = (rawKey) => {
  const segments = String(rawKey).split('.');
  if (segments.length === 1) return { key: segments[0] };
  if (segments.length !== 2 || segments.some((segment) => !segment || /[\[\]]/.test(segment))) {
    throw new Error(`Questionnaire item key ${rawKey} requires an explicit recursive spec`);
  }
  const [field, responseKey] = segments;
  return {
    key: `${field}_${responseKey}`,
    responseBinding: /^\d+$/.test(responseKey)
      ? { field, index: Number(responseKey) }
      : { field, key: responseKey },
  };
};
const choiceItem = (key, prompt, options, extra = {}) => ({
  ...itemIdentity(key),
  prompt: String(prompt),
  type: 'single_choice',
  required: extra.required ?? true,
  options: contentOptions(options),
  ...extra,
});
const openItem = (key, prompt, type = 'number', extra = {}) => ({
  ...itemIdentity(key),
  prompt: String(prompt),
  type,
  required: extra.required ?? true,
  ...extra,
});
const selectField = (key, label, options, extra = {}) => ({
  key: String(key),
  label: String(label),
  type: 'select',
  required: extra.required ?? true,
  options: contentOptions(options),
  ...extra,
});
const numberContentField = (key, label, min, max, extra = {}) => ({
  key: String(key),
  label: String(label),
  type: 'number',
  required: extra.required ?? true,
  min,
  max,
  step: extra.step ?? 1,
  unit: extra.unit ?? 'score',
  ...extra,
});
const booleanContentField = (key, label, required = false) => ({
  key: String(key), label: String(label), type: 'boolean', required,
});
const textContentField = (key, label, required = false, type = 'text') => ({
  key: String(key), label: String(label), type, required,
});
const objectContentField = (key, label, fields, extra = {}) => ({
  key: String(key),
  label: String(label),
  type: 'object',
  required: extra.required ?? true,
  fields,
  ...extra,
});
const objectArrayContentField = (key, label, entries, extra = {}) => ({
  key: String(key),
  label: String(label),
  type: 'object[]',
  required: extra.required ?? true,
  minItems: extra.minItems ?? 1,
  maxItems: extra.maxItems,
  entries,
  ...extra,
});
const scalarArrayContentField = (key, label, items, extra = {}) => ({
  key: String(key),
  label: String(label),
  type: extra.type ?? 'number[]',
  required: extra.required ?? true,
  minItems: extra.minItems ?? items.length,
  maxItems: extra.maxItems ?? items.length,
  items,
  ...extra,
});

const FOUR_POINT_FREQUENCY = [
  contentOption('Not at all', 0),
  contentOption('Several days', 1),
  contentOption('More than half the days', 2),
  contentOption('Nearly every day', 3),
];
const ZERO_TO_FOUR_DIFFICULTY = [
  contentOption('Extreme difficulty or unable to perform', 0),
  contentOption('Quite a bit of difficulty', 1),
  contentOption('Moderate difficulty', 2),
  contentOption('A little bit of difficulty', 3),
  contentOption('No difficulty', 4),
];
const ZERO_TO_THREE_SEVERITY = [
  contentOption('No problem', 0),
  contentOption('Mild', 1),
  contentOption('Moderate', 2),
  contentOption('Severe', 3),
];

const QUESTIONNAIRE_ITEMS = {
  odi: PROM_NEURO_ODI_ODI_SECTIONS.map((section, index) => choiceItem(
    `section_scores.${index}`,
    section.name,
    section.options.map((label, value) => contentOption(label, value)),
    { section: index + 1 },
  )),
  sarc_f: PROM_NEURO_SARC_F_QUESTIONS.map((question) => choiceItem(
    `responses.${question.id}`,
    question.script,
    question.options,
    { domain: question.domain, example: question.example },
  )),
  ndi: PROM_NEURO_NDI_SECTIONS.map((section, index) => choiceItem(`responses.${index}`, section.title, section.options)),
  k10_full: PROM_NEURO_K10_QUESTIONS.map((prompt, index) => choiceItem(
    `responses.${index}`,
    prompt,
    PROM_NEURO_K10_OPTIONS,
  )),
  hoos_full: PROM_NEURO_HOOS_HOOS_SUBSCALES.flatMap((subscale) => subscale.items.map((key) => choiceItem(
    `responses.${key}`,
    PROM_NEURO_HOOS_QUESTIONS[key],
    PROM_NEURO_HOOS_SCORELABELS.map((label, value) => contentOption(label, value)),
    { subscale: subscale.label },
  ))),
  koos_full: Object.values(PROM_NEURO_KOOS_SECTIONS).flatMap((section) => section.questions.map((question) => choiceItem(
    `responses.${question.id}`,
    question.text,
    question.options.map((label, value) => contentOption(label, value)),
    { section: section.name, instruction: section.instruction },
  ))),
  fiqr: [
    ...PROM_NEURO_FIQR_FUNCTION_ITEMS.map((prompt, index) => choiceItem(
      `function_scores.${index}`,
      prompt,
      scoreContentOptions(0, 10),
      { domain: 'Function' },
    )),
    ...PROM_NEURO_FIQR_OVERALL_ITEMS.map((prompt, index) => choiceItem(
      `overall_scores.${index}`,
      prompt,
      scoreContentOptions(0, 10),
      { domain: 'Overall impact' },
    )),
    ...PROM_NEURO_FIQR_SYMPTOM_ITEMS.map((prompt, index) => choiceItem(
      `symptom_scores.${index}`,
      prompt,
      scoreContentOptions(0, 10),
      { domain: 'Symptoms' },
    )),
  ],
  wpi: [
    ...PROM_NEURO_WPI_WPI_REGIONS.map((region, index) => choiceItem(
      `pain_region_responses.${index}`,
      region,
      [contentOption('Not painful', false), contentOption('Painful', true)],
      { domain: 'Widespread Pain Index', responseEncoding: 'indexed boolean map; selected labels also populate pain_regions' },
    )),
    ...PROM_NEURO_WPI_SSS_ITEMS.map((item) => choiceItem(
      item.key === 'fatigue' ? 'sss_fatigue' : item.key === 'waking_unrefreshed' ? 'sss_waking' : 'sss_cognitive',
      item.label,
      ZERO_TO_THREE_SEVERITY,
      { domain: 'Symptom Severity Scale' },
    )),
    choiceItem(
      'sss_somatic',
      'Somatic symptoms (headache, pain/cramps, weakness, IBS, etc.)',
      PROM_NEURO_WPI_SOMATIC_OPTIONS,
      { domain: 'Symptom Severity Scale' },
    ),
  ],
  pcs: PROM_NEURO_PCS_PCS_ITEMS.map((item, index) => choiceItem(
    `responses.q${index + 1}`,
    item.text,
    PROM_NEURO_PCS_SCORE_LABELS.map((label, value) => contentOption(label, value)),
    { subscale: item.subscale },
  )),
  dsq2: [
    ...PROM_NEURO_DSQ2_SYMPTOM_DOMAINS.flatMap((domain) => domain.items.flatMap((prompt, localIndex) => {
      const preceding = PROM_NEURO_DSQ2_SYMPTOM_DOMAINS
        .slice(0, PROM_NEURO_DSQ2_SYMPTOM_DOMAINS.indexOf(domain))
        .reduce((total, current) => total + current.items.length, 0);
      const index = preceding + localIndex;
      return [
        choiceItem(`frequency_ratings.${index}`, `${prompt} — frequency`, PROM_NEURO_DSQ2_FREQ_OPTIONS, { domain: domain.domain }),
        choiceItem(`severity_ratings.${index}`, `${prompt} — severity`, PROM_NEURO_DSQ2_SEV_OPTIONS, { domain: domain.domain }),
      ];
    })),
    choiceItem(
      'pem_triggers',
      'Activities or exposures that trigger post-exertional malaise',
      PROM_NEURO_DSQ2_PEM_TRIGGERS.map((label) => contentOption(label, label)),
      {
        required: false,
        type: 'multi-select',
        minItems: 0,
        maxItems: PROM_NEURO_DSQ2_PEM_TRIGGERS.length,
      },
    ),
    choiceItem(
      'pem_recovery_time',
      'Typical recovery time after post-exertional malaise',
      PROM_NEURO_DSQ2_RECOVERY_OPTIONS.map((label) => contentOption(label, label)),
      { required: false },
    ),
    openItem('pem_notes', 'Describe the post-exertional malaise pattern', 'textarea', { required: false }),
  ],
  chalder_fatigue: [
    ...PROM_NEURO_CHALDER_PHYSICAL_Q,
    ...PROM_NEURO_CHALDER_MENTAL_Q,
  ].map((prompt, index) => choiceItem(
    `responses.${index}`,
    prompt,
    PROM_NEURO_CHALDER_OPTIONS_LIKERT.map((label, value) => contentOption(label, value)),
    { domain: index < PROM_NEURO_CHALDER_PHYSICAL_Q.length ? 'Physical fatigue' : 'Mental fatigue' },
  )),
  sf36: PROM_NEURO_SF36_SF36_QUESTIONS.map((question) => choiceItem(
    `responses.${question.id}`,
    question.text,
    PROM_NEURO_SF36_SCALE_OPTIONS[question.scale],
    { domain: question.domain, scale: question.scale },
  )),
  fss: PROM_NEURO_FSS_QUESTIONS.map((prompt, index) => choiceItem(
    `responses.${index}`,
    prompt,
    scoreContentOptions(1, 7),
  )),
  psqi: [
    openItem('bedtime', 'Usual bedtime', 'time', { required: false }),
    openItem('wake_time', 'Usual wake time', 'time', { required: false }),
    openItem('bed_hours', 'Hours spent in bed (bedtime to wake time)', 'number', { min: 0.1, max: 24 }),
    choiceItem('q2min', 'How long has it usually taken you to fall asleep each night during the past month?', PROM_NEURO_PSQI_LATENCY_MIN_OPTIONS),
    choiceItem('q5a', 'Trouble sleeping because you could not get to sleep within 30 minutes', PROM_NEURO_PSQI_FREQ_OPTIONS),
    choiceItem('q4hrs', 'Hours of actual sleep each night during the past month', PROM_NEURO_PSQI_DURATION_OPTIONS),
    ...[
      ['q5b', 'Woke up in the middle of the night or early morning'],
      ['q5c', 'Had to get up to use the bathroom'],
      ['q5d', 'Could not breathe comfortably'],
      ['q5e', 'Coughed or snored loudly'],
      ['q5f', 'Felt too cold'],
      ['q5g', 'Felt too hot'],
      ['q5h', 'Had bad dreams'],
      ['q5i', 'Had pain'],
      ['q5j', 'Had another reason for trouble sleeping'],
    ].map(([key, prompt]) => choiceItem(key, prompt, PROM_NEURO_PSQI_FREQ_OPTIONS)),
    choiceItem('q6', 'Used medicine to help you sleep', PROM_NEURO_PSQI_FREQ_OPTIONS),
    choiceItem('q7', 'Had trouble staying awake while driving, eating meals, or engaging in social activity', PROM_NEURO_PSQI_FREQ_OPTIONS),
    choiceItem('q8', 'How much of a problem has it been to keep up enough enthusiasm to get things done?', PROM_NEURO_PSQI_DYSFUNCTION_OPTIONS),
    choiceItem('q9', 'How would you rate your sleep quality overall?', PROM_NEURO_PSQI_Q1_OPTIONS),
  ],
  parq: PROM_NEURO_PARQ_PARQ_QUESTIONS.map((prompt, index) => choiceItem(
    `answers.${index}`,
    prompt,
    [contentOption('Yes', 'yes'), contentOption('No', 'no')],
  )),
  lefs: PROM_NEURO_LEFS_LEFS_ACTIVITIES.map((prompt, index) => choiceItem(
    `item_scores.${index}`,
    prompt,
    ZERO_TO_FOUR_DIFFICULTY,
  )),
  aqol: PROM_NEURO_AQOL_QUESTIONS.map((question) => choiceItem(
    `responses.${question.id}`,
    question.text,
    question.options,
    { domain: question.domain },
  )),
  spadi: [
    ...PROM_NEURO_SPADI_PAIN_ITEMS.map((prompt, index) => openItem(
      `pain_scores.${index}`,
      prompt,
      'number',
      { min: 0, max: 10, domain: 'Pain' },
    )),
    ...PROM_NEURO_SPADI_DISABILITY_ITEMS.map((prompt, index) => openItem(
      `disability_scores.${index}`,
      prompt,
      'number',
      { min: 0, max: 10, domain: 'Disability' },
    )),
  ],
  breq: PROM_NEURO_BREQ_ITEMS.map((item) => choiceItem(
    `responses.${item.num}`,
    item.text,
    PROM_NEURO_BREQ_RESPONSE_OPTIONS,
    { subscale: item.subscale },
  )),
  pase: [
    ...PROM_NEURO_PASE_LEISURE_ITEMS.map((item) => choiceItem(
      `leisure_responses.${item.id}`,
      item.label,
      [contentOption('Not done', 0), ...PROM_NEURO_PASE_LEISURE_HOURS],
      { section: 'Leisure activities' },
    )),
    ...PROM_NEURO_PASE_HOUSEHOLD_ITEMS.map((item) => choiceItem(
      `household_responses.${item.id}`,
      item.label,
      [contentOption('Yes', true), contentOption('No', false)],
      { section: 'Household activities' },
    )),
    choiceItem('work_done', 'Worked for pay or as a volunteer during the past 7 days', [
      contentOption('Yes', true), contentOption('No', false),
    ], { section: 'Work / volunteer activity' }),
    choiceItem('work_hours', 'Hours worked per week', PROM_NEURO_PASE_WORK_HOURS, {
      required: false, condition: 'work_done is true', section: 'Work / volunteer activity',
    }),
    choiceItem(
      'work_type',
      'Type of work',
      PROM_NEURO_PASE_WORK_TYPE_OPTIONS.map((label) => contentOption(label, label)),
      { required: false, section: 'Work / volunteer activity' },
    ),
  ],
  womac: Object.entries(PROM_NEURO_WOMAC_WOMAC_SECTIONS).flatMap(([section, prompts]) => prompts.map((prompt, index) => choiceItem(
    `item_scores.${section}_${index}`,
    prompt,
    [
      contentOption('None', 0),
      contentOption('Mild', 1),
      contentOption('Moderate', 2),
      contentOption('Severe', 3),
      contentOption('Extreme', 4),
    ],
    { section },
  ))),
  barthel: PROM_NEURO_BARTHEL_ITEMS.map((item) => choiceItem(
    `item_scores.${item.key}`,
    `${item.label}: ${item.description}`,
    item.options,
  )),
  abc_scale: PROM_NEURO_ABC_ACTIVITIES.map((prompt, index) => openItem(
    `activities_responses.${index}`,
    prompt,
    'number',
    { min: 0, max: 100, step: 10, unit: 'percent confidence' },
  )),
  roland: PROM_NEURO_ROLAND_STATEMENTS.map((prompt, index) => choiceItem(
    `items_checked.${index}`,
    prompt,
    [contentOption('Does not apply', false), contentOption('Applies today', true)],
  )),
  dash: PROM_NEURO_DASH_DASH_QUESTIONS.map((question, index) => choiceItem(
    `responses.${index}`,
    question.text,
    PROM_NEURO_DASH_OPTION_SETS[question.section],
    { section: question.section },
  )),
  faam: [
    ...PROM_NEURO_FAAM_ADL_ITEMS.map((prompt, index) => choiceItem(
      `adl_responses.${index}`,
      prompt,
      PROM_NEURO_FAAM_SCORE_OPTIONS,
      { required: false, subscale: 'Activities of daily living' },
    )),
    ...PROM_NEURO_FAAM_SPORTS_ITEMS.map((prompt, index) => choiceItem(
      `sports_responses.${index}`,
      prompt,
      PROM_NEURO_FAAM_SCORE_OPTIONS,
      { required: false, subscale: 'Sports' },
    )),
  ],
  ikdc: PROM_NEURO_IKDC_IKDC_QUESTIONS.map((question) => choiceItem(
    `ikdc_responses.${question.id}`,
    question.label,
    scoreContentOptions(0, question.max, question.anchors),
    { subscale: question.subscale, anchors: question.anchors },
  )),
  cat: PROM_NEURO_CAT_QUESTIONS.map((question) => choiceItem(
    `responses.${question.key}`,
    question.text,
    scoreContentOptions(0, 5, { 0: question.anchorLeft, 5: question.anchorRight }),
    { leftAnchor: question.anchorLeft, rightAnchor: question.anchorRight },
  )),
  ccq: PROM_NEURO_CCQ_DOMAINS.flatMap((domain) => domain.items.map((item) => choiceItem(
    `responses.${item.id}`,
    item.text,
    PROM_NEURO_CCQ_OPTIONS,
    { domain: domain.label },
  ))),
  lcq: PROM_NEURO_LCQ_LCQ_DOMAINS.flatMap((domain) => domain.items.map((item) => choiceItem(
    `responses.${item.id}`,
    item.text,
    PROM_NEURO_LCQ_SCALE,
    { domain: domain.label },
  ))),
  fesi: PROM_NEURO_FESI_FESI_ACTIVITIES.map((prompt, index) => choiceItem(
    `responses.${index}`,
    prompt,
    Object.entries(PROM_NEURO_FESI_CONCERN_LABELS).map(([value, label]) => contentOption(label, Number(value))),
  )),
  pcl5: PROM_NEURO_PCL5_PCL5_ITEMS.map((item) => choiceItem(
    `raw_responses.${item.id}`,
    item.text,
    PROM_NEURO_PCL5_RESPONSE_OPTIONS,
  )),
  isi: PROM_NEURO_ISI_QUESTIONS.map((question) => choiceItem(
    `responses.q${question.number}`,
    question.text,
    [
      contentOption(question.number === 4 ? 'Very satisfied' : 'Not at all', 0),
      contentOption('Slight', 1),
      contentOption('Moderate', 2),
      contentOption('Serious', 3),
      contentOption(question.number === 4 ? 'Very dissatisfied' : 'Very serious', 4),
    ],
    { subscale: question.subscale },
  )),
  phq9_full: PROM_NEURO_PHQ9_QUESTIONS.map((prompt, index) => choiceItem(
    `responses.${index}`,
    prompt,
    PROM_NEURO_PHQ9_OPTIONS.map((label, value) => contentOption(label, value)),
  )),
  gad7_full: PROM_NEURO_GAD7_QUESTIONS.map((prompt, index) => choiceItem(
    `responses.${index}`,
    prompt,
    PROM_NEURO_GAD7_OPTIONS.map((label, value) => contentOption(label, value)),
  )),
};

const vitalsContentField = (key, label) => objectContentField(key, label, [
  numberContentField('heartRate', 'Heart rate', 20, 250, { required: false, unit: 'bpm' }),
  textContentField('bloodPressure', 'Blood pressure', false),
], { required: false });

const trialObjectContentField = (key, label) => objectContentField(key, label, [
  numberContentField('time', 'Completion time', 0.01, 3600, { unit: 'seconds', step: 0.01 }),
  numberContentField('completed', 'Items completed', 1, 50, { unit: 'items' }),
  numberContentField('errors', 'Errors', 0, 50, { unit: 'errors' }),
  numberContentField('selfCorrections', 'Self-corrections', 0, 50, { required: false, unit: 'corrections' }),
]);

const digitSpanTrialSchema = (label) => objectContentField('trial', label, [
  numberContentField('length', 'Sequence length', 1, 20, { unit: 'digits' }),
  {
    key: 'sequence',
    label: 'Presented digit sequence',
    type: 'number[]',
    required: true,
    minItems: 1,
    maxItems: 20,
    cardinality: 'must equal trial.length',
    itemSchema: numberContentField('digit', 'Presented digit', 0, 9, { unit: 'digit' }),
  },
  textContentField('response', 'Client response', true),
  booleanContentField('correct', 'Response correct', true),
]);

const tardieuVelocityField = (velocity) => objectContentField(velocity.key, velocity.label, [
  selectField(
    'tardieu_score',
    'Tardieu score',
    PROM_NEURO_TARDIEU_TARDIEU_SCORES,
  ),
  numberContentField('r1_angle', 'R1 angle', -360, 360, { required: velocity.key === 'v3', unit: 'degrees' }),
  numberContentField('r2_angle', 'R2 angle', -360, 360, { required: velocity.key === 'v1', unit: 'degrees' }),
  numberContentField('catch_angle', 'Catch angle', -360, 360, { required: false, unit: 'degrees' }),
  booleanContentField('clonus_present', 'Clonus present'),
  numberContentField('clonus_duration', 'Clonus duration', 0, 3600, { required: false, unit: 'seconds' }),
  numberContentField('clonus_beats', 'Clonus beats', 0, 1000, { required: false, unit: 'beats' }),
  selectField('clonus_sustained', 'Clonus type', [
    contentOption('Sustained', 'Sustained'),
    contentOption('Unsustained', 'Unsustained'),
  ], { required: false }),
], { description: velocity.desc });

const EXPANDED_FIELDS = {
  fma: [
    objectContentField(
      'item_scores',
      'Fugl-Meyer item scores',
      PROM_NEURO_FMA_SECTIONS.flatMap((section) => section.items.map((label, index) => selectField(
        `${section.key}_${index}`,
        `${section.label}: ${label}`,
        scoreContentOptions(0, 2),
        { section: section.label },
      ))),
    ),
  ],
  promis_fatigue: [
    numberContentField('raw_score', 'Raw score (sum of 8 externally administered items)', 8, 40, {
      required: false, unit: 'points',
    }),
    numberContentField('t_score', 'PROMIS T-score', 20, 90, {
      required: false, unit: 'T-score', step: 0.1,
    }),
    textContentField('assessor_name', 'Assessor name'),
    { key: 'assessment_date', label: 'Assessment date', type: 'date', required: true },
  ],
  dgi_full: [
    objectArrayContentField(
      'tasks',
      'Dynamic Gait Index tasks',
      PROM_NEURO_DGI_TASKS.map((task, index) => objectContentField(
        String(index),
        task.name,
        [
          { ...textContentField('name', 'Task name', true), constant: task.name },
          selectField(
            'score',
            'Task score',
            task.scores.map((scoreLabel, value) => contentOption(scoreLabel, value)),
          ),
        ],
        { order: index + 1, instructions: task.instructions },
      )),
      { minItems: PROM_NEURO_DGI_TASKS.length, maxItems: PROM_NEURO_DGI_TASKS.length },
    ),
    vitalsContentField('pre_vitals', 'Pre-test vitals'),
    vitalsContentField('post_vitals', 'Post-test vitals'),
  ],
  fga: [
    objectContentField(
      'item_scores',
      'Functional Gait Assessment item scores',
      PROM_NEURO_FGA_ITEMS.map((item, index) => selectField(
        item.id,
        item.label,
        PROM_NEURO_FGA_SCORE_LABELS.map((label, value) => contentOption(label, value)),
        { order: index + 1 },
      )),
    ),
  ],
  gas: [
    objectArrayContentField(
      'goals',
      'Patient-specific goals',
      [
        textContentField('goal', 'Patient-specific goal', true, 'textarea'),
        numberContentField('importance', 'Importance', 0, 3, { unit: 'points' }),
        numberContentField('difficulty', 'Difficulty', 0, 3, { unit: 'points' }),
        selectField('attainmentLevel', 'Attainment level', PROM_NEURO_GAS_ATTAINMENT_OPTIONS),
      ],
      { minItems: 1, maxItems: 20 },
    ),
  ],
  psfs: [
    objectArrayContentField(
      'activities',
      'Patient-specific activities',
      [
        textContentField('name', 'Activity description', true),
        selectField(
          'score',
          'Current ability (0 = unable to perform; 10 = able at prior level)',
          PROM_NEURO_PSFS_SCORE_OPTIONS.map((value) => contentOption(String(value), value)),
        ),
      ],
      { minItems: 1, maxItems: 5 },
    ),
  ],
  qbpds: [
    numberContentField('total_score', 'Entered Quebec Back Pain Disability Scale total', 0, 100, { unit: 'points' }),
    textContentField('assessor_name', 'Assessor name'),
    { key: 'assessment_date', label: 'Assessment date', type: 'date', required: true },
  ],
  himat_full: [
    objectContentField(
      'scores',
      'High-Level Mobility Assessment Tool task scores',
      PROM_NEURO_HIMAT_ITEMS.map((item) => selectField(
        item.key,
        item.label,
        Object.entries(item.scoringCriteria).map(([value, label]) => contentOption(label, Number(value))),
        { description: item.description },
      )),
    ),
    vitalsContentField('pre_vitals', 'Pre-test vitals'),
    vitalsContentField('post_vitals', 'Post-test vitals'),
  ],
  stroop: [
    trialObjectContentField('trial1', 'Word-reading trial'),
    trialObjectContentField('trial2', 'Colour-naming trial'),
    trialObjectContentField('trial3', 'Interference trial'),
    objectContentField('setup', 'Test setup', [
      selectField('environment', 'Environment', ['Quiet clinic room', 'Clinic — some noise', 'Ward / bedside', 'Home visit', 'Noisy environment'].map((value) => contentOption(value, value))),
      selectField('noiseLevel', 'Noise level', ['Low', 'Moderate', 'High'].map((value) => contentOption(value, value))),
      textContentField('dominantLanguage', 'Dominant language', true),
      selectField('educationLevel', 'Education level', ['Primary school', 'Secondary school', 'Trade / Cert', 'Undergraduate', 'Postgraduate'].map((value) => contentOption(value, value)), { required: false }),
      textContentField('neurologicalDiagnosis', 'Neurological diagnosis'),
      booleanContentField('visualImpairment', 'Visual impairment present'),
      booleanContentField('glassesWorn', 'Glasses worn for testing'),
      booleanContentField('clinicianAdministered', 'Clinician administered'),
      numberContentField('baselineFatigue', 'Baseline fatigue', 0, 10, { unit: '/10' }),
      numberContentField('baselineConcentration', 'Baseline concentration', 0, 10, { unit: '/10' }),
    ]),
    objectContentField('observations', 'Test observations', [
      booleanContentField('frustration', 'Frustration / emotional dysregulation'),
      booleanContentField('selfMonitoring', 'Self-monitoring / self-correction'),
      booleanContentField('impulsivity', 'Impulsive responses noted'),
      booleanContentField('perseveration', 'Perseverative errors'),
      booleanContentField('fatigueDuringTest', 'Cognitive fatigue during test'),
      booleanContentField('verbalStrategies', 'Used verbal strategies'),
      textContentField('behaviorNotes', 'Behaviour notes', false, 'textarea'),
    ]),
  ],
  digit_span: [
    objectArrayContentField(
      'forward_trials',
      'Forward digit-span trials',
      [digitSpanTrialSchema('Forward digit-span trial')],
      { minItems: 1, maxItems: 30 },
    ),
    objectArrayContentField(
      'backward_trials',
      'Backward digit-span trials',
      [digitSpanTrialSchema('Backward digit-span trial')],
      { minItems: 1, maxItems: 30 },
    ),
  ],
  mas: [
    objectArrayContentField(
      'muscles',
      'Assessed muscle groups',
      [
        objectContentField('muscle_assessment', 'Muscle assessment', [
          selectField('muscle', 'Muscle group', PROM_NEURO_MAS_MUSCLES.map((value) => contentOption(value, value))),
          selectField(
            'score',
            'Modified Ashworth grade',
            PROM_NEURO_MAS_MAS_GRADES.map((grade) => contentOption(grade.label, String(grade.score))),
          ),
        ]),
      ],
      { minItems: 1, maxItems: 50 },
    ),
  ],
  tardieu: [
    objectContentField('header', 'Assessment header', [
      textContentField('diagnosis', 'Diagnosis / condition'),
      selectField('side_tested', 'Side tested', ['Right', 'Left', 'Bilateral'].map((value) => contentOption(value, value))),
      selectField('limb_tested', 'Limb tested', ['Upper Limb', 'Lower Limb', 'Both'].map((value) => contentOption(value, value)), { required: false }),
      selectField('position', 'Session position', ['Supine', 'Sitting', 'Standing', 'Side-lying', 'Prone'].map((value) => contentOption(value, value)), { required: false }),
      textContentField('clinician_notes', 'General clinical notes', false, 'textarea'),
    ]),
    objectArrayContentField(
      'entries',
      'Muscle-group velocity records',
      [
        objectContentField('muscle_group_entry', 'Muscle-group assessment', [
          selectField(
            'muscle_group',
            'Muscle group',
            Object.values(PROM_NEURO_TARDIEU_MUSCLE_GROUPS).flat().map((value) => contentOption(value, value)),
          ),
          selectField('side', 'Side', ['Left', 'Right', 'Bilateral'].map((value) => contentOption(value, value))),
          selectField('position', 'Position', ['Supine', 'Sitting', 'Standing', 'Side-lying', 'Prone'].map((value) => contentOption(value, value))),
          ...PROM_NEURO_TARDIEU_VELOCITIES.map(tardieuVelocityField),
          textContentField('notes', 'Muscle-group clinical notes', false, 'textarea'),
        ]),
      ],
      { minItems: 1, maxItems: 30 },
    ),
  ],
  mas_stroke: [
    objectContentField(
      'item_scores',
      'Motor Assessment Scale for Stroke item scores',
      PROM_NEURO_MAS_STROKE_ITEMS.map((item) => selectField(
        item.key,
        item.label,
        item.grades.map((grade) => contentOption(grade.desc, grade.score)),
      )),
    ),
  ],
  rivermead_mobility: [
    objectContentField(
      'individual_tasks',
      'Rivermead Mobility Index task responses',
      PROM_NEURO_RIVERMEAD_RMI_TASKS.map((task) => selectField(
        task.id,
        `${task.name}: ${task.description}`,
        [contentOption('No', 0), contentOption('Yes', 1)],
      )),
    ),
  ],
  cbm_full: [
    objectContentField(
      'scores',
      'Community Balance and Mobility task scores',
      PROM_NEURO_CBM_TASKS.map((task) => selectField(
        task.name,
        task.name,
        scoreContentOptions(0, 5),
        { description: task.description, scoringCriteria: task.scoring },
      )),
    ),
    vitalsContentField('preVitals', 'Pre-test vitals'),
    vitalsContentField('postVitals', 'Post-test vitals'),
  ],
  bestest_full: [
    selectField('version', 'Test version', [
      contentOption('Full BESTest (36 items)', 'full'),
      contentOption('Mini-BESTest (14 items)', 'mini'),
    ]),
    selectField('assistive_device', 'Assistive device', ['none', 'cane', 'walker', 'other'].map((value) => contentOption(value, value))),
    objectContentField(
      'item_scores',
      'BESTest item scores',
      PROM_NEURO_BESTEST_BESTEST_SECTIONS.flatMap((section, sectionIndex) => section.items.map((label, itemIndex) => selectField(
        `${sectionIndex}-${itemIndex}`,
        `${section.name}: ${label}`,
        scoreContentOptions(0, 3),
        { section: section.name },
      ))),
    ),
    textContentField('tasks_modified', 'Tasks modified or omitted', false, 'textarea'),
    textContentField('domain_comments', 'Domain comments', false, 'textarea'),
  ],
  ems_full: [
    objectContentField(
      'item_scores',
      'Elderly Mobility Scale item scores',
      Object.entries(PROM_NEURO_EMS_EMS_LABELS).map(([key, label]) => selectField(
        key,
        label,
        scoreContentOptions(0, 3),
        { scoringCriteria: PROM_NEURO_EMS_EMS_SCORING[key] },
      )),
    ),
  ],
  pediatric_balance: [
    scalarArrayContentField(
      'scores',
      'Pediatric Balance Scale item scores',
      PROM_NEURO_PEDIATRIC_BALANCE_ITEMS.map((item, index) => selectField(
        String(index),
        item.label,
        item.criteria.map((label, criterionIndex) => contentOption(label, 4 - criterionIndex)),
        { instructions: item.instructions },
      )),
      {
        type: 'number[]',
        minItems: PROM_NEURO_PEDIATRIC_BALANCE_ITEMS.length,
        maxItems: PROM_NEURO_PEDIATRIC_BALANCE_ITEMS.length,
      },
    ),
    vitalsContentField('pre_vitals', 'Pre-test vitals'),
    vitalsContentField('post_vitals', 'Post-test vitals'),
  ],
  ppt_full: [
    textContentField('assessor_name', 'Assessor name'),
    { key: 'assessment_date', label: 'Assessment date', type: 'date', required: true },
    selectField('version', 'PPT version', [
      contentOption('7-item', '7-item'),
      contentOption('9-item', '9-item'),
    ]),
    booleanContentField('gait_aid_used', 'Gait aid used'),
    booleanContentField('safe_to_proceed', 'Clinician judges client safe to proceed', true),
    selectField('supervision_level', 'Supervision level', [
      contentOption('Independent', 'independent'),
      contentOption('Supervision', 'supervision'),
      contentOption('Physical assistance', 'physical_assistance'),
    ], { required: false }),
    {
      key: 'safety_concerns',
      label: 'Safety concerns observed',
      type: 'multi-select',
      required: false,
      minItems: 0,
      maxItems: PROM_NEURO_PPT_SAFETY_CONCERNS.length,
      options: contentOptions(PROM_NEURO_PPT_SAFETY_CONCERNS),
    },
    objectContentField(
      'taskScores',
      'Versioned task scores',
      PROM_NEURO_PPT_TASKS['9-item'].map((task) => selectField(
        task.id,
        `${task.name}: score`,
        [
          contentOption('Unable', 0),
          contentOption('Poor', 1),
          contentOption('Fair', 2),
          contentOption('Good', 3),
          contentOption('Excellent', 4),
        ],
        {
          required: task.number <= 7,
          ...(task.number > 7 ? { condition: '9-item version' } : {}),
        },
      )),
    ),
    objectContentField(
      'taskTimes',
      'Versioned task times',
      PROM_NEURO_PPT_TASKS['9-item'].map((task) => numberContentField(
        task.id,
        `${task.name}: time`,
        0,
        3600,
        { required: false, unit: 'seconds', step: 0.1 },
      )),
    ),
    objectContentField(
      'taskNotes',
      'Versioned task notes',
      PROM_NEURO_PPT_TASKS['9-item'].map((task) => textContentField(
        task.id,
        `${task.name}: notes`,
        false,
        'textarea',
      )),
    ),
  ],
};

const FUNCTIONAL_IMPAIRMENT_OPTIONS = [
  contentOption('Not difficult at all', 'Not difficult at all'),
  contentOption('Somewhat difficult', 'Somewhat difficult'),
  contentOption('Very difficult', 'Very difficult'),
  contentOption('Extremely difficult', 'Extremely difficult'),
];

const QUESTIONNAIRE_FIELDS = {
  wpi: [
    {
      key: 'pain_regions',
      label: 'Pain regions selected in the last week',
      type: 'choice[]',
      required: false,
      minItems: 0,
      maxItems: PROM_NEURO_WPI_WPI_REGIONS.length,
      uniqueItems: true,
      options: PROM_NEURO_WPI_WPI_REGIONS.map((region) => contentOption(region, region)),
      derivedFrom: 'pain_region_responses',
    },
  ],
  parq: [
    textContentField('other_reasons', 'Other reasons physical activity may not be appropriate', false, 'textarea'),
  ],
  womac: [
    selectField('joint', 'Joint assessed', [
      contentOption('Knee', 'knee'),
      contentOption('Hip', 'hip'),
    ]),
    selectField('side', 'Side assessed', [
      contentOption('Right', 'right'),
      contentOption('Left', 'left'),
      contentOption('Bilateral', 'bilateral'),
    ]),
  ],
  phq9_full: [
    selectField('functional_impairment', 'Difficulty caused by these problems', FUNCTIONAL_IMPAIRMENT_OPTIONS, { required: false }),
  ],
  gad7_full: [
    selectField('functional_impairment', 'Difficulty caused by these problems', FUNCTIONAL_IMPAIRMENT_OPTIONS, { required: false }),
  ],
};

function createSpec([runnerKey, title, kind, primaryField, unit, method]) {
  const items = QUESTIONNAIRE_ITEMS[runnerKey];
  if (kind === 'questionnaire' && (!Array.isArray(items) || items.length === 0)) {
    throw new Error(`Questionnaire runner ${runnerKey} must expose complete ordered items`);
  }
  return deepFreeze({
    schemaVersion: 1,
    kind,
    runnerKey,
    scoringKey: runnerKey,
    title,
    fields: kind === 'questionnaire'
      ? [...(QUESTIONNAIRE_FIELDS[runnerKey] || []), textField('notes', 'Clinical notes')]
      : [...(EXPANDED_FIELDS[runnerKey] || []), textField('notes', 'Clinical notes')],
    ...(kind === 'questionnaire' ? { items } : {}),
    scoring: { method, version: `${runnerKey}.v1`, failClosed: true },
    result: {
      primaryField,
      unit,
      additionalDataFields: ['measurement_type', 'scoring_key', 'scoring_version', 'raw_input', 'soap_text', 'report_text', primaryField],
    },
  });
}

export const RUNNER_SPECS = Object.freeze(ROUTES.map(createSpec));
const SPEC_BY_KEY = Object.freeze(Object.fromEntries(RUNNER_SPECS.map((spec) => [spec.runnerKey, spec])));

export function hasPromNeuroScorer(runnerKey) {
  return Object.hasOwn(SPEC_BY_KEY, runnerKey);
}

function sourceOf(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Assessment input must be an object');
  const source = input.additional_data && typeof input.additional_data === 'object' && !Array.isArray(input.additional_data)
    ? input.additional_data
    : input;
  assertFiniteDeep(source, 'Assessment input');
  return source;
}

function assertFiniteDeep(value, label, seen = new Set()) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${label} contains a non-finite number`);
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) assertFiniteDeep(child, `${label}.${key}`, seen);
}

function requiredNumber(value, label, { min, max, integer = false }) {
  if (value === '' || value === null || value === undefined) throw new Error(`${label} is required`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${label} must be ${integer ? 'a whole' : 'a finite'} number from ${min} to ${max}`);
  }
  return parsed;
}

function optionalNumber(value, label, bounds) {
  if (value === '' || value === null || value === undefined) return undefined;
  return requiredNumber(value, label, bounds);
}

function requiredArray(value, label, length) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (length !== undefined && value.length !== length) throw new Error(`${label} must contain exactly ${length} entries`);
  return value;
}

function requiredObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requiredBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false`);
  return value;
}

function requiredText(value, label, maxLength = 500) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
  return text;
}

function optionalText(value, maxLength = NOTES_MAX) {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) throw new Error(`Text must be ${maxLength} characters or fewer`);
  return text;
}

function requiredChoice(value, label, allowed) {
  const selected = requiredText(value, label);
  if (!allowed.includes(selected)) throw new Error(`${label} must be one of: ${allowed.join(', ')}`);
  return selected;
}

function optionalChoice(value, label, allowed) {
  const selected = optionalText(value);
  if (!selected) return '';
  if (!allowed.includes(selected)) throw new Error(`${label} must be one of: ${allowed.join(', ')}`);
  return selected;
}

function optionalVitals(value, label) {
  if (value === undefined || value === null) return undefined;
  const object = requiredObject(value, label);
  const heartRate = optionalNumber(object.heartRate, `${label} heart rate`, { min: 20, max: 250 });
  const bloodPressure = optionalText(object.bloodPressure, 100);
  return {
    ...(heartRate === undefined ? {} : { heartRate }),
    ...(bloodPressure ? { bloodPressure } : {}),
  };
}

function vector(value, label, length, min, max, { integer = true, nullable = false, minAnswered = length } = {}) {
  const values = requiredArray(value, label, length);
  const parsed = values.map((entry, index) => {
    if (nullable && (entry === null || entry === '')) return null;
    return requiredNumber(entry, `${label} item ${index + 1}`, { min, max, integer });
  });
  if (nullable && parsed.filter((entry) => entry !== null).length < minAnswered) {
    throw new Error(`${label} must contain at least ${minAnswered} scored entries`);
  }
  return parsed;
}

/**
 * @param {{ integer?: boolean, allowedByKey?: Record<string, readonly number[]> }} [options]
 */
function keyedScores(value, label, keys, min, max, options = {}) {
  const { integer = true, allowedByKey } = options;
  const object = requiredObject(value, label);
  const expected = new Set(keys.map(String));
  for (const key of Object.keys(object)) {
    if (!expected.has(String(key))) throw new Error(`${label} contains unsupported key ${key}`);
  }
  return Object.fromEntries(keys.map((key) => {
    if (!Object.hasOwn(object, key)) throw new Error(`${label}.${key} is required`);
    const parsed = requiredNumber(object[key], `${label}.${key}`, { min, max, integer });
    const allowedScores = allowedByKey?.[key];
    if (allowedByKey && (!allowedScores || !allowedScores.includes(parsed))) throw new Error(`${label}.${key} is not an allowed score`);
    return [key, parsed];
  }));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function cleanClone(value) {
  if (Array.isArray(value)) return value.map(cleanClone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .map(([key, child]) => [key, cleanClone(child)]));
}

function finish(runnerKey, input, context, resultValue, computed, summaryLines = []) {
  if (!Number.isFinite(resultValue)) throw new Error(`${runnerKey} scorer did not produce a finite result`);
  const spec = SPEC_BY_KEY[runnerKey];
  const source = sourceOf(input);
  const assessmentDate = String(context.assessmentDate || input.assessment_date || todayLocal());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(assessmentDate)) throw new Error('Assessment date must use YYYY-MM-DD');
  const notes = optionalText(context.notes ?? input.notes ?? '');
  const rawInput = cleanClone(Object.fromEntries(Object.entries(source).filter(([key]) => ![
    'soap_text', 'report_text', 'raw_input', 'scoring_key', 'scoring_version',
  ].includes(key))));
  const scoreLabel = `${resultValue} ${spec.result.unit}`.trim();
  const soapText = [
    `• ${context.assessmentName || spec.title}`,
    `  Result: ${scoreLabel}`,
    `  Scoring: ${spec.scoring.method} (${spec.scoring.version})`,
    ...summaryLines.map((line) => `  ${line}`),
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  const reportText = [
    context.assessmentName || spec.title,
    `Assessment date: ${assessmentDate}`,
    `Result: ${scoreLabel}`,
    `Scorer: ${spec.scoring.version}`,
    ...summaryLines,
    `Recorded inputs: ${JSON.stringify(rawInput)}`,
    notes ? `Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  const payload = {
    status: 'completed',
    result_value: resultValue,
    assessment_date: assessmentDate,
    notes,
    additional_data: {
      ...cleanClone(source),
      ...cleanClone(computed),
      measurement_type: source.measurement_type || spec.kind,
      scoring_key: runnerKey,
      scoring_version: spec.scoring.version,
      raw_input: rawInput,
      soap_text: soapText,
      report_text: reportText,
    },
  };
  assertFiniteDeep(payload, `${runnerKey} payload`);
  return payload;
}

function objectValuesByKeys(object, keys) {
  return keys.map((key) => object[key]);
}

const rangeKeys = (prefix, count, start = 1) => Array.from({ length: count }, (_, index) => `${prefix}${index + start}`);
const numericKeys = (count, start = 0) => Array.from({ length: count }, (_, index) => String(index + start));

const FMA_SECTIONS = Object.freeze([
  Object.freeze({ section: 'upper_extremity', count: 23 }),
  Object.freeze({ section: 'lower_extremity', count: 18 }),
  Object.freeze({ section: 'balance', count: 7 }),
  Object.freeze({ section: 'sensation', count: 15 }),
  Object.freeze({ section: 'joint_rom', count: 22 }),
]);
const HOOS_SUBSCALES = Object.freeze({
  Symptoms: ['S1', 'S2', 'S3', 'S4', 'S5'],
  Pain: rangeKeys('P', 10),
  ActivitiesOfDailyLiving: rangeKeys('A', 17),
  SportAndRecreation: rangeKeys('SP', 4),
  QualityOfLife: rangeKeys('Q', 4),
});
const KOOS_SUBSCALES = Object.freeze({
  symptoms: rangeKeys('Sy', 7), pain: rangeKeys('P', 9), adl: rangeKeys('A', 17), sport: rangeKeys('Sp', 5), qol: rangeKeys('Q', 4),
});
const FGA_KEYS = Object.freeze(['gait_level', 'change_speed', 'horizontal_head', 'vertical_head', 'pivot_turn', 'over_obstacle', 'narrow_bos', 'eyes_closed', 'backwards', 'stairs']);
const HIMAT_MAX = Object.freeze({ walk: 6, walk_backwards: 6, walk_on_toes: 6, run: 6, skip: 6, hop_on_spot: 6, forward_bound: 6, stair_walk_up: 4, stair_walk_down: 4, stair_run_up: 4 });
const BARTHEL_ALLOWED = Object.freeze({
  feeding: [0, 5, 10], bathing: [0, 5], grooming: [0, 5], dressing: [0, 5, 10], bowelControl: [0, 5, 10], bladderControl: [0, 5, 10], toiletUse: [0, 5, 10], transfers: [0, 5, 10, 15], mobility: [0, 5, 10, 15], stairs: [0, 5, 10],
});
const MAS_STROKE_KEYS = Object.freeze(['supineToSideLying', 'supineToSitting', 'balancedSitting', 'sittingToStanding', 'walking', 'upperArmFunction', 'handMovements', 'handActivities']);
const EMS_KEYS = Object.freeze(['lyingToSitting', 'sittingToLying', 'sitToStand', 'standing', 'gait', 'timedWalk', 'functionalReach']);
const PPT_TASKS = Object.freeze({
  '7-item': ['task_1_sentence', 'task_2_eating', 'task_3_book_lift', 'task_4_jacket', 'task_5_pickup', 'task_6_turn', 'task_7_walk'],
  '9-item': ['task_1_sentence', 'task_2_eating', 'task_3_book_lift', 'task_4_jacket', 'task_5_pickup', 'task_6_turn', 'task_7_walk', 'task_8_stairs', 'task_9_progressive_romberg'],
});
const IKDC_MAX = Object.freeze({ q1_pain: 10, q2_stiffness: 4, q3_swelling: 10, q4_lock_catch: 2, q5_giving_way: 10, q6_stairs_up: 4, q7_stairs_down: 4, q8_kneel: 4, q9_squat: 4, q10_sit_bent: 4, q11_rise_chair: 4, q12_run_straight: 4, q13_jump_land: 4, q14_stop_quickly: 4 });
const LCQ_DOMAINS = Object.freeze({ physical: rangeKeys('P', 7), psychological: rangeKeys('Ps', 6), social: rangeKeys('S', 6) });
const SF36_DOMAINS = Object.freeze({ PF: rangeKeys('', 10), RP: rangeKeys('', 4, 11), BP: rangeKeys('', 2, 15), GH: rangeKeys('', 5, 17), VT: rangeKeys('', 4, 22), SF: rangeKeys('', 2, 26), RE: rangeKeys('', 3, 28), MH: rangeKeys('', 6, 31) });
const SF36_ALLOWED_MAX = Object.freeze(Object.fromEntries([
  ...rangeKeys('', 10).map((key) => [key, 3]), ...rangeKeys('', 4, 11).map((key) => [key, 2]), ['15', 6], ['16', 5], ...rangeKeys('', 5, 17).map((key) => [key, 5]), ...rangeKeys('', 4, 22).map((key) => [key, 6]), ...rangeKeys('', 2, 26).map((key) => [key, 3]), ...rangeKeys('', 3, 28).map((key) => [key, 2]), ...rangeKeys('', 6, 31).map((key) => [key, 6]),
]));
const PROMIS_T = Object.freeze([33.1, 38.5, 41, 42.8, 44.3, 45.6, 46.9, 48.1, 49.2, 50.4, 51.5, 52.5, 53.6, 54.6, 55.6, 56.6, 57.5, 58.5, 59.4, 60.4, 61.3, 62.3, 63.3, 64.3, 65.3, 66.4, 67.5, 68.6, 69.8, 71, 72.4, 74.2, 77.8]);

export function scoreOdi(input, context = {}) {
  const source = sourceOf(input);
  const scores = keyedScores(source.section_scores, 'ODI section scores', numericKeys(10), 0, 5);
  const total = sum(Object.values(scores));
  const percentage = Math.round((total / 50) * 100);
  const interpretation = percentage <= 20 ? 'Minimal Disability' : percentage <= 40 ? 'Moderate Disability' : percentage <= 60 ? 'Severe Disability' : percentage <= 80 ? 'Crippling Back Pain' : 'Bed-bound or Exaggerating';
  return finish('odi', input, context, percentage, { section_scores: scores, total_score: total, percentage, interpretation }, [`Raw total: ${total}/50`, `Interpretation: ${interpretation}`]);
}

export function scoreFma(input, context = {}) {
  const source = sourceOf(input);
  const keys = FMA_SECTIONS.flatMap(({ section, count }) => Array.from({ length: count }, (_, index) => `${section}_${index}`));
  const scores = keyedScores(source.item_scores, 'FMA item scores', keys, 0, 2);
  const sectionScores = Object.fromEntries(FMA_SECTIONS.map(({ section, count }) => [section, sum(Array.from({ length: count }, (_, index) => scores[`${section}_${index}`]))]));
  const total = sum(Object.values(sectionScores));
  return finish('fma', input, context, total, { item_scores: scores, ...sectionScores, section_scores: sectionScores, total_score: total, max_total: 182 }, [`Section scores: ${JSON.stringify(sectionScores)}`]);
}

export function scoreSarcF(input, context = {}) {
  const source = sourceOf(input);
  const candidate = source.responses || { 1: source.q1_strength, 2: source.q2_walking, 3: source.q3_chair_rise, 4: source.q4_stairs, 5: source.q5_falls };
  const responses = keyedScores(candidate, 'SARC-F responses', ['1', '2', '3', '4', '5'], 0, 2);
  const total = sum(Object.values(responses));
  const risk = total >= 8 ? 'High' : total >= 4 ? 'Moderate' : 'Low';
  return finish('sarc_f', input, context, total, {
    responses, total_score: total, risk_level: risk, probable_sarcopenia: total >= 4,
    q1_strength: responses['1'], q2_walking: responses['2'], q3_chair_rise: responses['3'], q4_stairs: responses['4'], q5_falls: responses['5'],
  }, [`Risk level: ${risk}`]);
}

export function scoreNdi(input, context = {}) {
  const source = sourceOf(input);
  const responses = keyedScores(source.responses, 'NDI responses', numericKeys(10), 0, 5);
  const total = sum(Object.values(responses));
  const percentage = round((total / 50) * 100, 1);
  const interpretation = percentage <= 8 ? 'No disability' : percentage <= 28 ? 'Mild disability' : percentage <= 48 ? 'Moderate disability' : percentage <= 68 ? 'Severe disability' : 'Complete disability';
  return finish('ndi', input, context, percentage, { responses, total_score: total, percentage, interpretation }, [`Raw total: ${total}/50`, `Interpretation: ${interpretation}`]);
}

export function scoreK10(input, context = {}) {
  const source = sourceOf(input);
  const responses = vector(source.responses, 'K10 responses', 10, 1, 5);
  const total = sum(responses);
  const distressLevel = total <= 19 ? 'Likely well' : total <= 24 ? 'Mild distress' : total <= 29 ? 'Moderate distress' : 'Severe distress';
  return finish('k10_full', input, context, total, { responses, total_score: total, distress_level: distressLevel }, [`Distress level: ${distressLevel}`]);
}

function scoreNormalisedSubscales(runnerKey, input, context, definitions, responseField, outputField) {
  const source = sourceOf(input);
  const keys = Object.values(definitions).flat();
  const responses = keyedScores(source[responseField], `${runnerKey} responses`, keys, 0, 4);
  const subscaleScores = Object.fromEntries(Object.entries(definitions).map(([name, itemKeys]) => {
    const raw = sum(itemKeys.map((key) => responses[key]));
    return [name, round(100 - ((raw / (itemKeys.length * 4)) * 100), 1)];
  }));
  const average = round(sum(Object.values(subscaleScores)) / Object.keys(subscaleScores).length, 1);
  return finish(runnerKey, input, context, average, { [responseField]: responses, [outputField]: subscaleScores, average_score: average }, [`Subscales: ${JSON.stringify(subscaleScores)}`]);
}

export const scoreHoos = (input, context = {}) => scoreNormalisedSubscales('hoos_full', input, context, HOOS_SUBSCALES, 'responses', 'subscale_scores');
export const scoreKoos = (input, context = {}) => scoreNormalisedSubscales('koos_full', input, context, KOOS_SUBSCALES, 'responses', 'section_scores');

export function scoreFiqr(input, context = {}) {
  const source = sourceOf(input);
  const functionScores = vector(source.function_scores, 'FIQR function scores', 9, 0, 10);
  const overallScores = vector(source.overall_scores, 'FIQR overall scores', 2, 0, 10);
  const symptomScores = vector(source.symptom_scores, 'FIQR symptom scores', 10, 0, 10);
  const functionDomain = round(sum(functionScores) / 3, 1);
  const overallDomain = sum(overallScores);
  const symptomDomain = round(sum(symptomScores) / 2, 1);
  const total = round(functionDomain + overallDomain + symptomDomain, 1);
  const severity = total < 39 ? 'Mild' : total < 59 ? 'Moderate' : 'Severe';
  return finish('fiqr', input, context, total, {
    function_scores: functionScores, overall_scores: overallScores, symptom_scores: symptomScores,
    function_domain_score: functionDomain, overall_domain_score: overallDomain, symptom_domain_score: symptomDomain, total_score: total, severity,
  }, [`Domains: function ${functionDomain}/30, overall ${overallDomain}/20, symptoms ${symptomDomain}/50`, `Severity: ${severity}`]);
}

const WPI_REGIONS = Object.freeze(['Left jaw', 'Right jaw', 'Left shoulder', 'Right shoulder', 'Left upper arm', 'Right upper arm', 'Left lower arm', 'Right lower arm', 'Left hip (buttock/trochanter)', 'Right hip (buttock/trochanter)', 'Left upper leg', 'Right upper leg', 'Left lower leg', 'Right lower leg', 'Left chest', 'Right chest', 'Upper back', 'Lower back', 'Abdomen', 'Neck']);

export function scoreWpi(input, context = {}) {
  const source = sourceOf(input);
  const painRegionResponses = Object.fromEntries(WPI_REGIONS.map((region, index) => [
    String(index),
    requiredBoolean(requiredObject(source.pain_region_responses, 'Pain-region responses')[String(index)], `Pain-region response ${region}`),
  ]));
  const painRegions = WPI_REGIONS.filter((_, index) => painRegionResponses[String(index)]);
  if (source.pain_regions !== undefined) {
    const submittedPainRegions = requiredArray(source.pain_regions, 'Pain regions');
    if (new Set(submittedPainRegions).size !== submittedPainRegions.length) throw new Error('Pain regions must not contain duplicates');
    for (const region of submittedPainRegions) if (!WPI_REGIONS.includes(region)) throw new Error(`Unsupported pain region: ${region}`);
    if (submittedPainRegions.length !== painRegions.length || submittedPainRegions.some((region) => !painRegions.includes(region))) {
      throw new Error('Pain-region labels must match indexed pain-region responses');
    }
  }
  const fatigue = requiredNumber(source.sss_fatigue, 'SSS fatigue', { min: 0, max: 3, integer: true });
  const waking = requiredNumber(source.sss_waking, 'SSS waking', { min: 0, max: 3, integer: true });
  const cognitive = requiredNumber(source.sss_cognitive, 'SSS cognitive', { min: 0, max: 3, integer: true });
  const somatic = requiredNumber(source.sss_somatic, 'SSS somatic', { min: 0, max: 3, integer: true });
  const wpi = painRegions.length;
  const sss = fatigue + waking + cognitive + somatic;
  const total = wpi + sss;
  const meetsAcr = (wpi >= 7 && sss >= 5) || (wpi >= 3 && wpi <= 6 && sss >= 9);
  return finish('wpi', input, context, total, { pain_region_responses: painRegionResponses, pain_regions: painRegions, wpi_score: wpi, sss_score: sss, total_score: total, meets_acr_criteria: meetsAcr, sss_fatigue: fatigue, sss_waking: waking, sss_cognitive: cognitive, sss_somatic: somatic }, [`WPI: ${wpi}/19`, `SSS: ${sss}/12`]);
}

export function scorePcs(input, context = {}) {
  const source = sourceOf(input);
  const responses = keyedScores(source.responses, 'PCS responses', rangeKeys('q', 13), 0, 4);
  const total = sum(Object.values(responses));
  const rumination = sum([7, 8, 9, 10].map((index) => responses[`q${index + 1}`]));
  const magnification = sum([5, 6, 12].map((index) => responses[`q${index + 1}`]));
  const helplessness = sum([0, 1, 2, 3, 4, 11].map((index) => responses[`q${index + 1}`]));
  const interpretation = total <= 20 ? 'Low Catastrophizing' : total <= 29 ? 'Moderate Catastrophizing' : 'High Catastrophizing (Clinically Significant)';
  return finish('pcs', input, context, total, { responses, total_score: total, rumination, magnification, helplessness, interpretation }, [`Rumination: ${rumination}/16`, `Magnification: ${magnification}/12`, `Helplessness: ${helplessness}/24`]);
}

export function scoreDsq2(input, context = {}) {
  const source = sourceOf(input);
  const frequency = vector(source.frequency_ratings, 'DSQ-2 frequency ratings', 56, 0, 4);
  const severityRaw = requiredArray(source.severity_ratings, 'DSQ-2 severity ratings', 56);
  const severity = severityRaw.map((entry, index) => {
    if (frequency[index] === 0 && (entry === null || entry === '')) return null;
    return requiredNumber(entry, `DSQ-2 severity rating ${index + 1}`, { min: 0, max: 4, integer: true });
  });
  let totalComposite = 0;
  let scoredItems = 0;
  frequency.forEach((frequencyScore, index) => {
    if (frequencyScore > 0) {
      totalComposite += frequencyScore * severity[index];
      scoredItems += 1;
    }
  });
  const composite = scoredItems ? round(totalComposite / (scoredItems * 16), 2) : 0;
  const domainLengths = [5, 5, 5, 7, 7, 8, 8, 11];
  const domainNames = ['Post-Exertional Malaise (PEM)', 'Sleep Problems', 'Pain', 'Neurocognitive Symptoms', 'Autonomic Manifestations', 'Neuroendocrine Manifestations', 'Immune Manifestations', 'Additional Symptoms'];
  let offset = 0;
  const domainScores = Object.fromEntries(domainLengths.map((length, index) => {
    const value = round(sum(frequency.slice(offset, offset + length)) / length, 1);
    offset += length;
    return [domainNames[index], value];
  }));
  return finish('dsq2', input, context, composite, { frequency_ratings: frequency, severity_ratings: severity, composite_score: composite, total_composite: totalComposite, scored_items: scoredItems, domain_scores: domainScores }, [`Scored symptoms: ${scoredItems}/56`, `Domain frequency means: ${JSON.stringify(domainScores)}`]);
}

export function scoreChalder(input, context = {}) {
  const source = sourceOf(input);
  const responses = vector(source.responses, 'Chalder responses', 11, 0, 3);
  const likert = sum(responses);
  const bimodal = sum(responses.map((value) => value >= 2 ? 1 : 0));
  const physical = sum(responses.slice(0, 8));
  const mental = sum(responses.slice(8));
  const level = bimodal >= 4 ? 'Significant fatigue' : 'Below caseness threshold';
  return finish('chalder_fatigue', input, context, bimodal, { responses, bimodal_score: bimodal, likert_score: likert, physical_subscale: physical, mental_subscale: mental, fatigue_level: level }, [`Likert total: ${likert}/33`, `Physical: ${physical}/24; mental: ${mental}/9`]);
}

export function scoreSf36(input, context = {}) {
  const source = sourceOf(input);
  const responseObject = requiredObject(source.responses, 'SF-36 responses');
  const responses = Object.fromEntries(Object.keys(SF36_ALLOWED_MAX).map((key) => {
    if (!Object.hasOwn(responseObject, key)) throw new Error(`SF-36 response ${key} is required`);
    return [key, requiredNumber(responseObject[key], `SF-36 response ${key}`, { min: 1, max: SF36_ALLOWED_MAX[key], integer: true })];
  }));
  const domains = Object.fromEntries(Object.entries(SF36_DOMAINS).map(([domain, keys]) => [domain, Math.round((sum(keys.map((key) => responses[key])) / (keys.length * 6)) * 100)]));
  const pcs = Math.round((domains.PF + domains.RP + domains.BP + domains.GH) / 4);
  const mcs = Math.round((domains.VT + domains.SF + domains.RE + domains.MH) / 4);
  return finish('sf36', input, context, pcs, { responses, pcs, mcs, physical_component_summary: pcs, mental_component_summary: mcs, domain_scores: { physical_functioning: domains.PF, role_physical: domains.RP, bodily_pain: domains.BP, general_health: domains.GH, vitality: domains.VT, social_functioning: domains.SF, role_emotional: domains.RE, mental_health: domains.MH } }, [`Physical component: ${pcs}/100`, `Mental component: ${mcs}/100`]);
}

export function scoreFss(input, context = {}) {
  const source = sourceOf(input);
  const responses = vector(source.responses, 'FSS responses', 9, 1, 7);
  const total = sum(responses);
  const mean = round(total / 9, 2);
  return finish('fss', input, context, mean, { responses, totalScore: total, meanScore: mean, total_score: total, mean_score: mean, fatigue_level: mean >= 4 ? 'Significant fatigue' : 'Minimal fatigue' }, [`Total: ${total}/63`]);
}

export function scorePromisFatigue(input, context = {}) {
  const source = sourceOf(input);
  const assessorName = optionalText(source.assessor_name, 200);
  const raw = optionalNumber(source.raw_score, 'PROMIS raw score', { min: 8, max: 40, integer: true });
  const explicit = optionalNumber(source.t_score, 'PROMIS T-score', { min: 20, max: 90 });
  if (raw === undefined && explicit === undefined) throw new Error('PROMIS raw score or explicit T-score is required');
  const lookedUp = raw === undefined ? undefined : PROMIS_T[raw - 8];
  if (raw !== undefined && explicit !== undefined && round(explicit, 1) !== lookedUp) throw new Error(`PROMIS T-score must match raw-score lookup (${lookedUp})`);
  const tScore = lookedUp ?? round(explicit, 1);
  const level = tScore < 50 ? 'Fatigue below general population average' : tScore < 60 ? 'Fatigue within average range' : tScore < 70 ? 'Moderate fatigue' : 'Severe fatigue';
  return finish('promis_fatigue', input, context, tScore, { assessor_name: assessorName, raw_score: raw ?? null, t_score: tScore, scoring_mode: raw === undefined ? 'explicit-t-score' : 'raw-score-lookup', interpretation: level }, [`Interpretation: ${level}`]);
}

export function scorePsqi(input, context = {}) {
  const source = sourceOf(input);
  const bedtime = optionalText(source.bedtime, 100);
  const wakeTime = optionalText(source.wake_time, 100);
  const bedHours = requiredNumber(source.bed_hours, 'PSQI hours spent in bed', { min: 0.1, max: 24 });
  const q2min = requiredNumber(source.q2min, 'PSQI sleep-latency band', { min: 0, max: 3, integer: true });
  const q5a = requiredNumber(source.q5a, 'PSQI latency-frequency response', { min: 0, max: 3, integer: true });
  const q4hrs = requiredNumber(source.q4hrs, 'PSQI sleep-duration band', { min: 0, max: 3, integer: true });
  const disturbanceKeys = ['q5b', 'q5c', 'q5d', 'q5e', 'q5f', 'q5g', 'q5h', 'q5i', 'q5j'];
  const disturbances = Object.fromEntries(disturbanceKeys.map((key) => [
    key,
    requiredNumber(source[key], `PSQI ${key}`, { min: 0, max: 3, integer: true }),
  ]));
  const q6 = requiredNumber(source.q6, 'PSQI sleep-medication response', { min: 0, max: 3, integer: true });
  const q7 = requiredNumber(source.q7, 'PSQI daytime-sleepiness response', { min: 0, max: 3, integer: true });
  const q8 = requiredNumber(source.q8, 'PSQI enthusiasm response', { min: 0, max: 3, integer: true });
  const q9 = requiredNumber(source.q9, 'PSQI subjective-sleep-quality response', { min: 0, max: 3, integer: true });
  const latencySum = q2min + q5a;
  const disturbanceSum = sum(Object.values(disturbances));
  const dysfunctionSum = q7 + q8;
  const sleepHours = [7, 6.5, 5.5, 4][q4hrs];
  const efficiency = (sleepHours / bedHours) * 100;
  const components = {
    c1: q9,
    c2: latencySum === 0 ? 0 : latencySum <= 2 ? 1 : latencySum <= 4 ? 2 : 3,
    c3: q4hrs,
    c4: efficiency >= 85 ? 0 : efficiency >= 75 ? 1 : efficiency >= 65 ? 2 : 3,
    c5: disturbanceSum === 0 ? 0 : disturbanceSum <= 9 ? 1 : disturbanceSum <= 18 ? 2 : 3,
    c6: q6,
    c7: dysfunctionSum === 0 ? 0 : dysfunctionSum <= 2 ? 1 : dysfunctionSum <= 4 ? 2 : 3,
  };
  const total = sum(Object.values(components));
  const interpretation = total <= 5 ? 'Good Sleep Quality' : total <= 10 ? 'Poor Sleep Quality' : 'Severely Disturbed Sleep';
  return finish('psqi', input, context, total, {
    bedtime,
    wake_time: wakeTime,
    bed_hours: bedHours,
    q2min,
    q5a,
    q4hrs,
    ...disturbances,
    q6,
    q7,
    q8,
    q9,
    sleep_efficiency_percent: round(efficiency, 1),
    components,
    global_score: total,
    interpretation,
  }, [`Sleep efficiency: ${round(efficiency, 1)}%`, `Interpretation: ${interpretation}`]);
}

export function scoreDgi(input, context = {}) {
  const source = sourceOf(input);
  const tasks = requiredArray(source.tasks, 'DGI tasks', 8).map((task, index) => {
    const object = requiredObject(task, `DGI task ${index + 1}`);
    const name = requiredText(object.name, `DGI task ${index + 1} name`);
    const expectedName = PROM_NEURO_DGI_TASKS[index].name;
    if (name !== expectedName) throw new Error(`DGI task ${index + 1} name must be ${expectedName}`);
    return { ...cleanClone(object), name, score: requiredNumber(object.score, `DGI task ${index + 1} score`, { min: 0, max: 3, integer: true }) };
  });
  const total = sum(tasks.map(({ score }) => score));
  const interpretation = total < 19 ? 'Increased fall risk (score < 19)' : 'Low fall risk (score ≥ 19)';
  return finish('dgi_full', input, context, total, {
    tasks,
    totalScore: total,
    total_score: total,
    interpretation,
    pre_vitals: optionalVitals(source.pre_vitals, 'DGI pre-test vitals'),
    post_vitals: optionalVitals(source.post_vitals, 'DGI post-test vitals'),
  }, [`Interpretation: ${interpretation}`]);
}

export function scoreFga(input, context = {}) {
  const source = sourceOf(input);
  const scores = keyedScores(source.item_scores, 'FGA item scores', FGA_KEYS, 0, 3);
  const total = sum(Object.values(scores));
  const risk = total >= 27 ? 'Normal / Minimal Risk' : total >= 22 ? 'Low Fall Risk' : total >= 17 ? 'Moderate Fall Risk' : 'High Fall Risk';
  return finish('fga', input, context, total, { item_scores: scores, total_score: total, fall_risk: risk }, [`Fall-risk classification: ${risk}`]);
}

export function scoreParq(input, context = {}) {
  const source = sourceOf(input);
  const answersObject = requiredObject(source.answers, 'PAR-Q answers');
  const keys = numericKeys(7);
  const answers = Object.fromEntries(keys.map((key) => {
    const answer = String(answersObject[key] ?? '').toLowerCase();
    if (!['yes', 'no'].includes(answer)) throw new Error(`PAR-Q answer ${Number(key) + 1} must be yes or no`);
    return [key, answer];
  }));
  const yesCount = Object.values(answers).filter((answer) => answer === 'yes').length;
  return finish('parq', input, context, yesCount, { answers, yes_count: yesCount, requires_medical_clearance: yesCount > 0, other_reasons: optionalText(source.other_reasons) }, [`Yes responses: ${yesCount}/7`]);
}

export function scoreGas(input, context = {}) {
  const source = sourceOf(input);
  const goals = requiredArray(source.goals, 'GAS goals');
  if (goals.length < 1 || goals.length > 20) throw new Error('GAS goals must contain 1 to 20 entries');
  const validated = goals.map((goal, index) => {
    const object = requiredObject(goal, `Goal ${index + 1}`);
    return {
      ...cleanClone(object),
      goal: requiredText(object.goal, `Goal ${index + 1} description`),
      importance: requiredNumber(object.importance, `Goal ${index + 1} importance`, { min: 0, max: 3, integer: true }),
      difficulty: requiredNumber(object.difficulty, `Goal ${index + 1} difficulty`, { min: 0, max: 3, integer: true }),
      attainmentLevel: requiredNumber(object.attainmentLevel, `Goal ${index + 1} attainment`, { min: -2, max: 2, integer: true }),
    };
  });
  const total = sum(validated.map((goal) => goal.attainmentLevel * (goal.importance + goal.difficulty)));
  return finish('gas', input, context, total, { goals: validated, weighted_attainment: total, total_score: total }, [`Goals scored: ${validated.length}`]);
}

export function scorePsfs(input, context = {}) {
  const source = sourceOf(input);
  const activities = requiredArray(source.activities, 'PSFS activities');
  if (activities.length < 1 || activities.length > 5) throw new Error('PSFS activities must contain 1 to 5 entries');
  const validated = activities.map((activity, index) => {
    const object = requiredObject(activity, `PSFS activity ${index + 1}`);
    return { ...cleanClone(object), name: requiredText(object.name, `PSFS activity ${index + 1} name`), score: requiredNumber(object.score, `PSFS activity ${index + 1} score`, { min: 0, max: 10 }) };
  });
  const total = sum(validated.map(({ score }) => score));
  const mean = round(total / validated.length, 2);
  return finish('psfs', input, context, mean, { activities: validated, total_score: total, mean_score: mean }, [`Activities scored: ${validated.length}`, `Total: ${total}`]);
}

export function scoreLefs(input, context = {}) {
  const source = sourceOf(input);
  const scores = keyedScores(source.item_scores, 'LEFS item scores', numericKeys(20), 0, 4);
  const total = sum(Object.values(scores));
  const interpretation = total >= 60 ? 'Minimal Functional Limitation' : total >= 40 ? 'Moderate Functional Limitation' : 'Severe Functional Limitation';
  return finish('lefs', input, context, total, { item_scores: scores, total_score: total, interpretation, side: source.side }, [`Interpretation: ${interpretation}`]);
}

export function scoreHimat(input, context = {}) {
  const source = sourceOf(input);
  const scoreObject = requiredObject(source.scores, 'HiMAT scores');
  const scores = Object.fromEntries(Object.entries(HIMAT_MAX).map(([key, maximum]) => {
    if (!Object.hasOwn(scoreObject, key)) throw new Error(`HiMAT score ${key} is required`);
    return [key, requiredNumber(scoreObject[key], `HiMAT score ${key}`, { min: 0, max: maximum, integer: true })];
  }));
  const total = sum(Object.values(scores));
  const level = total >= 54 ? 'Full high-level community mobility' : total >= 42 ? 'Good mobility with minor limitations' : 'Impaired high-level mobility';
  return finish('himat_full', input, context, total, { scores, total_score: total, max_score: 54, mobility_level: level, pre_vitals: source.pre_vitals, post_vitals: source.post_vitals }, [`Mobility level: ${level}`]);
}

export function scoreAqol(input, context = {}) {
  const source = sourceOf(input);
  const responses = keyedScores(source.responses, 'AQoL responses', rangeKeys('aqol', 12), 0, 3);
  const domainMap = { 'Independent Living': rangeKeys('aqol', 3), Relationships: rangeKeys('aqol', 3, 4), Senses: rangeKeys('aqol', 3, 7), 'Mental Health': rangeKeys('aqol', 3, 10) };
  const domainScores = Object.fromEntries(Object.entries(domainMap).map(([name, keys]) => [name, sum(keys.map((key) => responses[key]))]));
  const total = sum(Object.values(responses));
  const interpretation = total <= 4 ? 'Excellent QoL' : total <= 10 ? 'Good QoL' : total <= 18 ? 'Moderate QoL impairment' : total <= 26 ? 'Significant QoL impairment' : 'Severe QoL impairment';
  return finish('aqol', input, context, total, { responses, domain_scores: domainScores, total_score: total, interpretation }, [`Domains: ${JSON.stringify(domainScores)}`, `Interpretation: ${interpretation}`]);
}

export function scoreSpadi(input, context = {}) {
  const source = sourceOf(input);
  const pain = keyedScores(source.pain_scores, 'SPADI pain scores', numericKeys(5), 0, 10);
  const disability = keyedScores(source.disability_scores, 'SPADI disability scores', numericKeys(8), 0, 10);
  const painSum = sum(Object.values(pain));
  const disabilitySum = sum(Object.values(disability));
  const painSubscale = round((painSum / 50) * 100, 1);
  const disabilitySubscale = round((disabilitySum / 80) * 100, 1);
  const total = Math.round((painSubscale + disabilitySubscale) / 2);
  const interpretation = total < 20 ? 'Minimal disability' : total < 40 ? 'Mild disability' : total < 60 ? 'Moderate disability' : 'Severe disability';
  return finish('spadi', input, context, total, { pain_scores: pain, disability_scores: disability, pain_sum: painSum, disability_sum: disabilitySum, pain_subscale: painSubscale, disability_subscale: disabilitySubscale, total_score: total, interpretation }, [`Pain: ${painSubscale}%`, `Disability: ${disabilitySubscale}%`, `Interpretation: ${interpretation}`]);
}

const BREQ_SUBSCALES = Object.freeze({ amotivation: [5, 9, 12, 19], external: [1, 6, 11, 16], introjected: [2, 7, 13], identified: [3, 8, 14, 17], intrinsic: [4, 10, 15, 18] });

export function scoreBreq(input, context = {}) {
  const source = sourceOf(input);
  const responses = keyedScores(source.responses, 'BREQ responses', rangeKeys('', 19), 0, 4);
  const means = Object.fromEntries(Object.entries(BREQ_SUBSCALES).map(([name, items]) => [name, sum(items.map((item) => responses[String(item)])) / items.length]));
  const rai = round((-3 * means.amotivation) + (-2 * means.external) - means.introjected + (2 * means.identified) + (3 * means.intrinsic), 2);
  const interpretation = rai >= 6 ? 'Highly Self-Determined' : rai >= 2 ? 'Moderately Self-Determined' : rai >= -2 ? 'Mixed / Moderate Motivation' : rai >= -6 ? 'Low Self-Determination' : 'Very Low Self-Determination / Amotivated';
  const roundedMeans = Object.fromEntries(Object.entries(means).map(([key, value]) => [key, round(value, 2)]));
  return finish('breq', input, context, rai, { responses, rai, relative_autonomy_index: rai, subscale_means: roundedMeans, interpretation }, [`Subscale means: ${JSON.stringify(roundedMeans)}`, `Interpretation: ${interpretation}`]);
}

const PASE_LEISURE = Object.freeze({ walking: [0.11, 0.32, 0.64, 1.07], light_sport: [0.13, 0.38, 0.76, 1.27], moderate_sport: [0.25, 0.75, 1.5, 2.5], strenuous_sport: [0.38, 1.13, 2.26, 3.77], muscle_exercise: [0.19, 0.57, 1.14, 1.9] });
const PASE_HOUSEHOLD = Object.freeze({ light_housework: 0.25, heavy_housework: 0.5, home_repairs: 0.5, lawn_garden: 0.5, outdoor_tasks: 0.5, caregiving: 0.35 });

export function scorePase(input, context = {}) {
  const source = sourceOf(input);
  const leisureObject = requiredObject(source.leisure_responses, 'PASE leisure responses');
  const leisure = Object.fromEntries(Object.keys(PASE_LEISURE).map((key) => [key, requiredNumber(leisureObject[key], `PASE leisure ${key}`, { min: 0, max: 4, integer: true })]));
  const householdObject = requiredObject(source.household_responses, 'PASE household responses');
  const household = Object.fromEntries(Object.keys(PASE_HOUSEHOLD).map((key) => [key, requiredBoolean(householdObject[key], `PASE household ${key}`)]));
  const workDone = requiredBoolean(source.work_done, 'PASE work completed');
  const workHours = workDone ? requiredNumber(source.work_hours, 'PASE work-hours band', { min: 1, max: 5, integer: true }) : null;
  const workType = optionalText(source.work_type, 100);
  if (workType && !PROM_NEURO_PASE_WORK_TYPE_OPTIONS.includes(workType)) throw new Error('PASE work type is not an allowed choice');
  let raw = sum(Object.entries(leisure).map(([key, band]) => band === 0 ? 0 : PASE_LEISURE[key][band - 1] * 100));
  raw += sum(Object.entries(household).map(([key, completed]) => completed ? PASE_HOUSEHOLD[key] * 100 : 0));
  if (workDone) raw += [10, 20, 30, 40, 50][workHours - 1];
  const total = Math.round(raw);
  const interpretation = total >= 120 ? 'Very High Physical Activity' : total >= 75 ? 'High Physical Activity' : total >= 40 ? 'Moderate Physical Activity' : 'Low Physical Activity';
  return finish('pase', input, context, total, { leisure_responses: leisure, household_responses: household, work_done: workDone, work_hours: workHours, work_type: workType, total_score: total, interpretation }, [`Interpretation: ${interpretation}`]);
}

export function scoreQbpds(input, context = {}) {
  const source = sourceOf(input);
  const assessorName = optionalText(source.assessor_name, 200);
  const total = requiredNumber(source.total_score ?? input.result_value, 'QBPDS entered total', { min: 0, max: 100 });
  const interpretation = total <= 20 ? 'Minimal disability' : total <= 40 ? 'Mild disability' : total <= 60 ? 'Moderate disability' : total <= 80 ? 'Severe disability' : 'Very severe disability';
  return finish('qbpds', input, context, total, { assessor_name: assessorName, total_score: total, interpretation, scoring_mode: 'validated-entered-total' }, [`Interpretation: ${interpretation}`]);
}

export function scoreWomac(input, context = {}) {
  const source = sourceOf(input);
  const keys = [...rangeKeys('pain_', 5, 0), ...rangeKeys('stiffness_', 2, 0), ...rangeKeys('function_', 17, 0)];
  const scores = keyedScores(source.item_scores, 'WOMAC item scores', keys, 0, 4);
  const pain = sum(rangeKeys('pain_', 5, 0).map((key) => scores[key]));
  const stiffness = sum(rangeKeys('stiffness_', 2, 0).map((key) => scores[key]));
  const functionScore = sum(rangeKeys('function_', 17, 0).map((key) => scores[key]));
  const total = pain + stiffness + functionScore;
  return finish('womac', input, context, total, { item_scores: scores, pain_score: pain, stiffness_score: stiffness, function_score: functionScore, total_score: total, pain_percent: Math.round((pain / 20) * 100), stiffness_percent: Math.round((stiffness / 8) * 100), function_percent: Math.round((functionScore / 68) * 100), joint: source.joint, side: source.side }, [`Pain: ${pain}/20`, `Stiffness: ${stiffness}/8`, `Function: ${functionScore}/68`]);
}

function validateStroopTrial(value, label) {
  const trial = requiredObject(value, label);
  const time = requiredNumber(trial.time, `${label} time`, { min: 0.01, max: 3600 });
  const completed = requiredNumber(trial.completed, `${label} completed items`, { min: 1, max: 50, integer: true });
  const errors = requiredNumber(trial.errors, `${label} errors`, { min: 0, max: completed, integer: true });
  const selfCorrections = requiredNumber(trial.selfCorrections ?? 0, `${label} self-corrections`, { min: 0, max: completed, integer: true });
  const accuracy = round(((completed - errors) / completed) * 100, 1);
  const score45s = round((completed / time) * 45, 1);
  return { ...cleanClone(trial), time, completed, errors, selfCorrections, accuracy, score_45s: score45s };
}

export function scoreStroop(input, context = {}) {
  const source = sourceOf(input);
  const t1 = validateStroopTrial(source.trial1, 'Stroop trial 1');
  const t2 = validateStroopTrial(source.trial2, 'Stroop trial 2');
  const t3 = validateStroopTrial(source.trial3, 'Stroop trial 3');
  const predicted = (t1.score_45s * t2.score_45s) / (t1.score_45s + t2.score_45s);
  const interference = round(t3.score_45s - predicted, 2);
  const classification = interference >= 5 ? 'Minimal Interference' : interference >= 0 ? 'Mild Interference' : interference >= -5 ? 'Moderate Interference' : 'Severe Interference';
  return finish('stroop', input, context, t3.time, { trial1: t1, trial2: t2, trial3: t3, interference_index: interference, interference_classification: classification, interference_trial_time: t3.time, setup: source.setup, observations: source.observations }, [`45-second equivalent scores: ${t1.score_45s}, ${t2.score_45s}, ${t3.score_45s}`, `Interference index: ${interference} (${classification})`]);
}

function digitTrials(value, label) {
  const trials = requiredArray(value, label);
  if (trials.length < 1 || trials.length > 30) throw new Error(`${label} must contain 1 to 30 trials`);
  return trials.map((trial, index) => {
    const object = requiredObject(trial, `${label} trial ${index + 1}`);
    const length = requiredNumber(object.length, `${label} trial ${index + 1} length`, { min: 1, max: 20, integer: true });
    const sequence = vector(object.sequence, `${label} trial ${index + 1} sequence`, length, 0, 9);
    const correct = requiredBoolean(object.correct, `${label} trial ${index + 1} correct state`);
    return { ...cleanClone(object), length, sequence, response: String(object.response ?? ''), correct };
  });
}

export function scoreDigitSpan(input, context = {}) {
  const source = sourceOf(input);
  const forward = digitTrials(source.forward_trials, 'Forward digit-span trials');
  const backward = digitTrials(source.backward_trials, 'Backward digit-span trials');
  const maximum = (trials) => trials.filter(({ correct }) => correct).reduce((current, { length }) => Math.max(current, length), 0);
  const forwardMax = maximum(forward);
  const backwardMax = maximum(backward);
  return finish('digit_span', input, context, forwardMax, { forward_trials: forward, backward_trials: backward, forward_max: forwardMax, backward_max: backwardMax }, [`Forward maximum: ${forwardMax}`, `Backward maximum: ${backwardMax}`]);
}

export function scoreMas(input, context = {}) {
  const source = sourceOf(input);
  const muscles = requiredArray(source.muscles, 'MAS muscle assessments');
  if (muscles.length < 1 || muscles.length > 50) throw new Error('MAS muscle assessments must contain 1 to 50 entries');
  const validated = muscles.map((entry, index) => {
    const object = requiredObject(entry, `MAS muscle ${index + 1}`);
    const muscle = requiredText(object.muscle, `MAS muscle ${index + 1} name`);
    const score = String(object.score);
    if (!['0', '1', '1+', '2', '3', '4'].includes(score)) throw new Error(`MAS muscle ${index + 1} score must be 0, 1, 1+, 2, 3 or 4`);
    return { muscle, score };
  });
  return finish('mas', input, context, validated.length, { muscles: validated, muscles_assessed: validated.length }, [`Muscles assessed: ${validated.length}`]);
}

const TARDIEU_MUSCLE_CHOICES = Object.freeze(Object.values(PROM_NEURO_TARDIEU_MUSCLE_GROUPS).flat());
const TARDIEU_SIDE_CHOICES = Object.freeze(['Left', 'Right', 'Bilateral']);
const TARDIEU_POSITION_CHOICES = Object.freeze(['Supine', 'Sitting', 'Standing', 'Side-lying', 'Prone']);
const TARDIEU_LIMB_CHOICES = Object.freeze(['Upper Limb', 'Lower Limb', 'Both']);
const TARDIEU_SCORE_CHOICES = Object.freeze(PROM_NEURO_TARDIEU_TARDIEU_SCORES.map(({ value }) => String(value)));

function validateTardieuVelocity(value, label, { requireR1 = false, requireR2 = false } = {}) {
  const velocity = requiredObject(value, label);
  const scoreText = requiredChoice(velocity.tardieu_score, `${label} score`, TARDIEU_SCORE_CHOICES);
  const r1 = requireR1
    ? requiredNumber(velocity.r1_angle, `${label} R1 angle`, { min: -360, max: 360 })
    : optionalNumber(velocity.r1_angle, `${label} R1 angle`, { min: -360, max: 360 });
  const r2 = requireR2
    ? requiredNumber(velocity.r2_angle, `${label} R2 angle`, { min: -360, max: 360 })
    : optionalNumber(velocity.r2_angle, `${label} R2 angle`, { min: -360, max: 360 });
  const catchAngle = optionalNumber(velocity.catch_angle, `${label} catch angle`, { min: -360, max: 360 });
  const clonusPresent = requiredBoolean(velocity.clonus_present, `${label} clonus-present state`);
  const clonusDuration = optionalNumber(velocity.clonus_duration, `${label} clonus duration`, { min: 0, max: 3600 });
  const clonusBeats = optionalNumber(velocity.clonus_beats, `${label} clonus beats`, { min: 0, max: 1000, integer: true });
  const clonusSustained = optionalChoice(velocity.clonus_sustained, `${label} clonus type`, ['Sustained', 'Unsustained']);
  return {
    ...cleanClone(velocity),
    tardieu_score: Number(scoreText),
    ...(r1 === undefined ? {} : { r1_angle: r1 }),
    ...(r2 === undefined ? {} : { r2_angle: r2 }),
    ...(catchAngle === undefined ? {} : { catch_angle: catchAngle }),
    clonus_present: clonusPresent,
    ...(clonusDuration === undefined ? {} : { clonus_duration: clonusDuration }),
    ...(clonusBeats === undefined ? {} : { clonus_beats: clonusBeats }),
    ...(clonusSustained ? { clonus_sustained: clonusSustained } : {}),
  };
}

export function scoreTardieu(input, context = {}) {
  const source = sourceOf(input);
  const headerSource = requiredObject(source.header, 'Tardieu assessment header');
  const header = {
    diagnosis: optionalText(headerSource.diagnosis, 500),
    side_tested: requiredChoice(headerSource.side_tested, 'Tardieu side tested', TARDIEU_SIDE_CHOICES),
    limb_tested: optionalChoice(headerSource.limb_tested, 'Tardieu limb tested', TARDIEU_LIMB_CHOICES),
    position: optionalChoice(headerSource.position, 'Tardieu session position', TARDIEU_POSITION_CHOICES),
    clinician_notes: optionalText(headerSource.clinician_notes, NOTES_MAX),
  };
  const entries = requiredArray(source.entries, 'Tardieu entries');
  if (entries.length < 1 || entries.length > 30) throw new Error('Tardieu entries must contain 1 to 30 muscle groups');
  const validated = entries.map((entry, index) => {
    const object = requiredObject(entry, `Tardieu entry ${index + 1}`);
    const v1 = validateTardieuVelocity(object.v1, `Tardieu entry ${index + 1} V1`, { requireR2: true });
    const v2 = validateTardieuVelocity(object.v2, `Tardieu entry ${index + 1} V2`);
    const v3 = validateTardieuVelocity(object.v3, `Tardieu entry ${index + 1} V3`, { requireR1: true });
    return {
      ...cleanClone(object),
      muscle_group: requiredChoice(object.muscle_group, `Tardieu entry ${index + 1} muscle group`, TARDIEU_MUSCLE_CHOICES),
      side: requiredChoice(object.side, `Tardieu entry ${index + 1} side`, TARDIEU_SIDE_CHOICES),
      position: requiredChoice(object.position, `Tardieu entry ${index + 1} position`, TARDIEU_POSITION_CHOICES),
      notes: optionalText(object.notes, 1000),
      v1,
      v2,
      v3,
      r2_minus_r1: v1.r2_angle - v3.r1_angle,
    };
  });
  const primary = validated[0];
  const difference = primary.r2_minus_r1;
  return finish('tardieu', input, context, difference, { entries: validated, header, primary_tardieu_score: primary.v3.tardieu_score, primary_r2_minus_r1: difference }, [`Primary R2 − R1: ${difference}°`, `Primary Tardieu score: ${primary.v3.tardieu_score}`]);
}

export function scoreBarthel(input, context = {}) {
  const source = sourceOf(input);
  const scores = keyedScores(source.item_scores, 'Barthel item scores', Object.keys(BARTHEL_ALLOWED), 0, 15, { allowedByKey: BARTHEL_ALLOWED });
  const total = sum(Object.values(scores));
  const interpretation = total >= 100 ? 'Fully Independent' : total >= 80 ? 'Minimal Dependence' : total >= 60 ? 'Partial Dependence' : total >= 40 ? 'Moderate Dependence' : 'High Dependence';
  return finish('barthel', input, context, total, { item_scores: scores, total_score: total, interpretation }, [`Interpretation: ${interpretation}`]);
}

export function scoreAbc(input, context = {}) {
  const source = sourceOf(input);
  const responses = vector(source.activities_responses, 'ABC activity responses', 16, 0, 100, { integer: false });
  const total = sum(responses);
  const mean = round(total / 16, 1);
  const interpretation = mean < 50 ? 'Low functioning' : mean < 67 ? 'Low balance confidence and fall risk' : 'Good balance confidence';
  return finish('abc_scale', input, context, mean, { activities_responses: responses, total_score: total, mean_score: mean, interpretation }, [`Interpretation: ${interpretation}`]);
}

export function scoreMasStroke(input, context = {}) {
  const source = sourceOf(input);
  const raw = source.item_scores || Object.fromEntries(MAS_STROKE_KEYS.map((key) => [key, source[key]]));
  const scores = keyedScores(raw, 'Motor Assessment Scale scores', MAS_STROKE_KEYS, 0, 6);
  const total = sum(Object.values(scores));
  return finish('mas_stroke', input, context, total, { item_scores: scores, ...scores, total_score: total }, [`Total: ${total}/48`]);
}

export function scoreRivermead(input, context = {}) {
  const source = sourceOf(input);
  const tasks = keyedScores(source.individual_tasks, 'Rivermead mobility tasks', rangeKeys('', 15), 0, 1);
  const total = sum(Object.values(tasks));
  const mobility = total <= 6 ? 'Poor mobility' : total <= 11 ? 'Limited mobility' : 'Good mobility';
  return finish('rivermead_mobility', input, context, total, { individual_tasks: tasks, score: total, total_score: total, max_score: 15, answered_count: 15, yes_count: total, no_count: 15 - total, unanswered_count: 0, completion_status: 'completed', mobility_level: mobility }, [`Mobility level: ${mobility}`]);
}

export function scoreRoland(input, context = {}) {
  const source = sourceOf(input);
  const checked = requiredArray(source.items_checked, 'Roland-Morris checked states', 24).map((value, index) => requiredBoolean(value, `Roland-Morris item ${index + 1}`));
  const total = checked.filter(Boolean).length;
  const level = total === 0 ? 'No disability' : total <= 4 ? 'Minimal disability' : total <= 8 ? 'Moderate disability' : total <= 16 ? 'Severe disability' : 'Very severe disability';
  return finish('roland', input, context, total, { items_checked: checked, total_score: total, disability_level: level }, [`Disability level: ${level}`]);
}

export function scoreDash(input, context = {}) {
  const source = sourceOf(input);
  const responses = vector(source.responses, 'DASH responses', 30, 1, 5);
  const score = round(((sum(responses) / 30 - 1) / 4) * 100, 1);
  const interpretation = score <= 20 ? 'Minimal disability' : score <= 40 ? 'Mild disability' : score <= 60 ? 'Moderate disability' : score <= 80 ? 'Severe disability' : 'Complete disability';
  return finish('dash', input, context, score, { responses, score, dash_score: score, interpretation }, [`Interpretation: ${interpretation}`]);
}

export function scoreFaam(input, context = {}) {
  const source = sourceOf(input);
  const adl = vector(source.adl_responses, 'FAAM ADL responses', 21, 0, 4, { nullable: true, minAnswered: 1 });
  const sports = vector(source.sports_responses, 'FAAM sport responses', 8, 0, 4, { nullable: true, minAnswered: 0 });
  const normalise = (values) => {
    const answered = values.filter((value) => value !== null);
    return answered.length ? round((sum(answered) / (answered.length * 4)) * 100, 1) : null;
  };
  const adlScore = normalise(adl);
  const sportsScore = normalise(sports);
  return finish('faam', input, context, adlScore, { adl_responses: adl, sports_responses: sports, adl_score: adlScore, sports_score: sportsScore }, [`ADL: ${adlScore}%`, sportsScore === null ? 'Sports: not scored' : `Sports: ${sportsScore}%`]);
}

export function scoreIkdc(input, context = {}) {
  const source = sourceOf(input);
  const raw = requiredObject(source.ikdc_responses, 'IKDC responses');
  const responses = Object.fromEntries(Object.entries(IKDC_MAX).map(([key, maximum]) => {
    if (!Object.hasOwn(raw, key)) throw new Error(`IKDC response ${key} is required`);
    return [key, requiredNumber(raw[key], `IKDC response ${key}`, { min: 0, max: maximum, integer: true })];
  }));
  const rawTotal = sum(Object.values(responses));
  const maximumTotal = sum(Object.values(IKDC_MAX));
  const score = round((rawTotal / maximumTotal) * 100, 1);
  const symptoms = sum(Object.keys(IKDC_MAX).slice(0, 5).map((key) => responses[key]));
  const functional = sum(Object.keys(IKDC_MAX).slice(5).map((key) => responses[key]));
  const category = score > 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 70 ? 'Fair' : 'Poor';
  return finish('ikdc', input, context, score, { ikdc_responses: responses, score_percent: score, ikdc_score_percent: score, raw_total: rawTotal, maximum_total: maximumTotal, symptoms_subscale: symptoms, function_subscale: functional, score_category: category }, [`Raw total: ${rawTotal}/${maximumTotal}`, `Category: ${category}`]);
}

export function scoreCat(input, context = {}) {
  const source = sourceOf(input);
  const keys = ['cough', 'phlegm', 'chestTightness', 'breathlessness', 'activities', 'confidence', 'sleep', 'energy'];
  const responses = keyedScores(source.responses, 'CAT responses', keys, 0, 5);
  const total = sum(Object.values(responses));
  const interpretation = total < 10 ? 'Low Impact' : total < 21 ? 'Medium Impact' : total < 31 ? 'High Impact' : 'Very High Impact';
  return finish('cat', input, context, total, { responses, total_score: total, cat_data: { score: total, interpretation, responses }, interpretation }, [`Impact: ${interpretation}`]);
}

export function scoreCcq(input, context = {}) {
  const source = sourceOf(input);
  const responses = keyedScores(source.responses, 'CCQ responses', numericKeys(10), 0, 6);
  const meanFor = (keys) => round(sum(keys.map((key) => responses[String(key)])) / keys.length, 2);
  const total = round(sum(Object.values(responses)) / 10, 2);
  const symptom = meanFor([0, 1, 2, 3]);
  const functional = meanFor([4, 5, 6]);
  const mental = meanFor([7, 8, 9]);
  const control = total < 1 ? 'Very good COPD control' : total < 2 ? 'Good COPD control' : total < 3 ? 'Moderate COPD control' : total < 4 ? 'Poor COPD control' : 'Very poor COPD control';
  return finish('ccq', input, context, total, { responses, total_mean: total, symptom_domain: symptom, functional_domain: functional, mental_domain: mental, control_level: control }, [`Domains: symptom ${symptom}, functional ${functional}, mental ${mental}`, `Control: ${control}`]);
}

export function scoreLcq(input, context = {}) {
  const source = sourceOf(input);
  const keys = Object.values(LCQ_DOMAINS).flat();
  const responses = keyedScores(source.responses, 'LCQ responses', keys, 1, 7);
  const domainScores = Object.fromEntries(Object.entries(LCQ_DOMAINS).map(([name, items]) => [name, round(sum(items.map((key) => responses[key])) / items.length, 2)]));
  const total = round(sum(Object.values(responses)) / keys.length, 2);
  const interpretation = total >= 5.5 ? 'Minimal cough impact' : total >= 4 ? 'Moderate cough impact' : 'Severe cough impact — consider specialist referral';
  return finish('lcq', input, context, total, { responses, total_mean: total, total_score: total, physical_score: domainScores.physical, psychological_score: domainScores.psychological, social_score: domainScores.social, interpretation }, [`Domains: ${JSON.stringify(domainScores)}`, `Interpretation: ${interpretation}`]);
}

const CBM_TASKS = Object.freeze(['Unilateral Stance', 'Tandem Walking', '180° Tandem Pivot', 'Lateral Foot Scooting', 'Hopping Forward', 'Crouch and Walk', 'Lateral Dodging', 'Walking and Looking', 'Running with Controlled Stop', 'Forward to Backward Walking', 'Walk, Look, and Carry', 'Descending Stairs', 'Step-Ups']);
const BESTEST_KEYS = Object.freeze([5, 3, 5, 5, 5, 6].flatMap((count, section) => Array.from({ length: count }, (_, item) => `${section}-${item}`)));

export function scoreCbm(input, context = {}) {
  const source = sourceOf(input);
  const scores = keyedScores(source.scores, 'CBM scores', CBM_TASKS, 0, 5);
  const total = sum(Object.values(scores));
  const interpretation = total >= 55 ? 'Community Ambulatory — High Level' : total >= 40 ? 'Community Ambulatory — Moderate Level' : total >= 25 ? 'Limited Community Ambulation' : 'Supervised/Supported Ambulation Required';
  return finish('cbm_full', input, context, total, { scores, totalScore: total, total_score: total, interpretation, preVitals: source.preVitals, postVitals: source.postVitals }, [`Classification: ${interpretation}`]);
}

export function scoreBestest(input, context = {}) {
  const source = sourceOf(input);
  const scores = keyedScores(source.item_scores, 'BESTest item scores', BESTEST_KEYS, 0, 3);
  const sectionCounts = [5, 3, 5, 5, 5, 6];
  const sectionNames = ['Biomechanical Constraints', 'Stability Limits/Verticality', 'Anticipatory Postural Adjustments', 'Postural Responses', 'Sensory Orientation', 'Stability in Gait'];
  const sectionScores = sectionCounts.map((count, section) => ({ section_name: sectionNames[section], section_total: sum(Array.from({ length: count }, (_, item) => scores[`${section}-${item}`])), section_max: count * 3 }));
  const total = sum(Object.values(scores));
  const percentage = round((total / 108) * 100, 1);
  const interpretation = percentage >= 80 ? 'Minimal Balance Impairment' : percentage >= 60 ? 'Moderate Balance Impairment' : 'High Balance Impairment/Falls Risk';
  return finish('bestest_full', input, context, total, { item_scores: scores, section_scores: sectionScores, total_score: total, percentage_score: percentage, interpretation, version: source.version, assistive_device: source.assistive_device, tasks_modified: source.tasks_modified, domain_comments: source.domain_comments }, [`Percentage: ${percentage}%`, `Interpretation: ${interpretation}`]);
}

export function scoreFesi(input, context = {}) {
  const source = sourceOf(input);
  const responses = vector(source.responses, 'FES-I responses', 16, 1, 4);
  const total = sum(responses);
  const concern = total <= 19 ? 'Low concern about falling (16–19)' : total <= 27 ? 'Moderate concern about falling (20–27)' : 'High concern about falling (28–64)';
  return finish('fesi', input, context, total, { responses, total_score: total, concern_level: concern }, [`Concern level: ${concern}`]);
}

export function scoreEms(input, context = {}) {
  const source = sourceOf(input);
  const scores = keyedScores(source.item_scores, 'EMS item scores', EMS_KEYS, 0, 3);
  const total = sum(Object.values(scores));
  const interpretation = total <= 10 ? 'High dependency (≤10)' : total <= 14 ? 'Borderline (11–14)' : 'Independent (15–20)';
  return finish('ems_full', input, context, total, { item_scores: scores, total_score: total, interpretation, pre_vitals: source.pre_vitals, post_vitals: source.post_vitals }, [`Interpretation: ${interpretation}`]);
}

export function scorePcl5(input, context = {}) {
  const source = sourceOf(input);
  const responses = keyedScores(source.raw_responses, 'PCL-5 responses', rangeKeys('', 20), 0, 4);
  const total = sum(Object.values(responses));
  const severity = total <= 13 ? 'Minimal' : total <= 27 ? 'Mild' : total <= 43 ? 'Moderate' : total <= 58 ? 'Severe' : 'Extreme';
  return finish('pcl5', input, context, total, { raw_responses: responses, total_score: total, severity_level: severity }, [`Severity: ${severity}`]);
}

export function scoreIsi(input, context = {}) {
  const source = sourceOf(input);
  const responses = keyedScores(source.responses, 'ISI responses', rangeKeys('q', 7), 0, 4);
  const total = sum(Object.values(responses));
  const severity = total <= 7 ? 'No clinically significant insomnia' : total <= 14 ? 'Subthreshold insomnia' : total <= 21 ? 'Clinical insomnia (moderate severity)' : 'Clinical insomnia (severe)';
  return finish('isi', input, context, total, { responses, total_score: total, severity }, [`Severity: ${severity}`]);
}

export function scorePediatricBalance(input, context = {}) {
  const source = sourceOf(input);
  const scores = vector(source.scores, 'Pediatric Balance Scale scores', 14, 0, 4);
  const total = sum(scores);
  const risk = total >= 46 ? 'Low Fall Risk' : total >= 31 ? 'Moderate Fall Risk' : 'High Fall Risk';
  return finish('pediatric_balance', input, context, total, { scores, total_score: total, fall_risk: risk, pre_vitals: source.pre_vitals, post_vitals: source.post_vitals }, [`Fall risk: ${risk}`]);
}

export function scorePpt(input, context = {}) {
  const source = sourceOf(input);
  const version = String(source.version || '');
  if (!Object.hasOwn(PPT_TASKS, version)) throw new Error('PPT version must be 7-item or 9-item');
  const safeToProceed = requiredBoolean(source.safe_to_proceed, 'PPT safe-to-proceed confirmation');
  if (!safeToProceed) throw new Error('PPT cannot be completed when safe-to-proceed is false');
  const gaitAidUsed = requiredBoolean(source.gait_aid_used, 'PPT gait-aid-used state');
  const scores = keyedScores(source.taskScores, 'PPT task scores', PPT_TASKS[version], 0, 4);
  const timesObject = source.taskTimes === undefined ? {} : requiredObject(source.taskTimes, 'PPT task times');
  const times = Object.fromEntries(Object.entries(timesObject).map(([key, value]) => {
    if (!PPT_TASKS[version].includes(key)) throw new Error(`PPT task time has unsupported key ${key}`);
    return [key, requiredNumber(value, `PPT task time ${key}`, { min: 0, max: 3600 })];
  }));
  const notesObject = source.taskNotes === undefined ? {} : requiredObject(source.taskNotes, 'PPT task notes');
  const taskNotes = Object.fromEntries(Object.entries(notesObject).map(([key, value]) => {
    if (!PPT_TASKS[version].includes(key)) throw new Error(`PPT task notes have unsupported key ${key}`);
    return [key, optionalText(value, 1000)];
  }));
  const safetyConcerns = source.safety_concerns === undefined
    ? []
    : requiredArray(source.safety_concerns, 'PPT safety concerns').map((value, index) => {
      const concern = requiredText(value, `PPT safety concern ${index + 1}`, 100);
      if (!PROM_NEURO_PPT_SAFETY_CONCERNS.some((option) => option.value === concern)) {
        throw new Error(`PPT safety concern ${concern} is not supported`);
      }
      return concern;
    });
  if (new Set(safetyConcerns).size !== safetyConcerns.length) throw new Error('PPT safety concerns must be unique');
  const total = sum(Object.values(scores));
  const maximum = version === '9-item' ? 36 : 28;
  const interpretation = total >= maximum * 0.75 ? 'Higher functional performance observed' : total >= maximum * 0.5 ? 'Moderate functional limitation present' : 'Marked functional limitation requiring further assessment and support';
  return finish('ppt_full', input, context, total, {
    version,
    assessor_name: optionalText(source.assessor_name, 200),
    taskScores: scores,
    taskTimes: times,
    taskNotes,
    total_score: total,
    max_score: maximum,
    gait_aid_used: gaitAidUsed,
    safe_to_proceed: safeToProceed,
    supervision_level: optionalText(source.supervision_level, 100),
    safety_concerns: safetyConcerns,
    interpretation,
  }, [`Version: ${version}`, `Interpretation: ${interpretation}`]);
}

export function scorePhq9(input, context = {}) {
  const source = sourceOf(input);
  const responses = vector(source.responses, 'PHQ-9 responses', 9, 0, 3);
  const total = sum(responses);
  const severity = total <= 4 ? 'Minimal Depression' : total <= 9 ? 'Mild Depression' : total <= 14 ? 'Moderate Depression' : total <= 19 ? 'Moderately Severe Depression' : 'Severe Depression';
  return finish('phq9_full', input, context, total, { responses, total_score: total, severity, q9_suicidal_ideation: responses[8] > 0, functional_impairment: source.functional_impairment }, [`Severity: ${severity}`, `Item 9 positive: ${responses[8] > 0 ? 'yes' : 'no'}`]);
}

export function scoreGad7(input, context = {}) {
  const source = sourceOf(input);
  const responses = vector(source.responses, 'GAD-7 responses', 7, 0, 3);
  const total = sum(responses);
  const severity = total <= 4 ? 'Minimal Anxiety' : total <= 9 ? 'Mild Anxiety' : total <= 14 ? 'Moderate Anxiety' : 'Severe Anxiety';
  return finish('gad7_full', input, context, total, { responses, total_score: total, severity, functional_impairment: source.functional_impairment }, [`Severity: ${severity}`]);
}

export const PROM_NEURO_SCORERS = Object.freeze({
  odi: scoreOdi,
  fma: scoreFma,
  sarc_f: scoreSarcF,
  ndi: scoreNdi,
  k10_full: scoreK10,
  hoos_full: scoreHoos,
  koos_full: scoreKoos,
  fiqr: scoreFiqr,
  wpi: scoreWpi,
  pcs: scorePcs,
  dsq2: scoreDsq2,
  chalder_fatigue: scoreChalder,
  sf36: scoreSf36,
  fss: scoreFss,
  promis_fatigue: scorePromisFatigue,
  psqi: scorePsqi,
  dgi_full: scoreDgi,
  fga: scoreFga,
  parq: scoreParq,
  gas: scoreGas,
  psfs: scorePsfs,
  lefs: scoreLefs,
  himat_full: scoreHimat,
  aqol: scoreAqol,
  spadi: scoreSpadi,
  breq: scoreBreq,
  pase: scorePase,
  qbpds: scoreQbpds,
  womac: scoreWomac,
  stroop: scoreStroop,
  digit_span: scoreDigitSpan,
  mas: scoreMas,
  tardieu: scoreTardieu,
  barthel: scoreBarthel,
  abc_scale: scoreAbc,
  mas_stroke: scoreMasStroke,
  rivermead_mobility: scoreRivermead,
  roland: scoreRoland,
  dash: scoreDash,
  faam: scoreFaam,
  ikdc: scoreIkdc,
  cat: scoreCat,
  ccq: scoreCcq,
  lcq: scoreLcq,
  cbm_full: scoreCbm,
  bestest_full: scoreBestest,
  fesi: scoreFesi,
  ems_full: scoreEms,
  pcl5: scorePcl5,
  isi: scoreIsi,
  pediatric_balance: scorePediatricBalance,
  ppt_full: scorePpt,
  phq9_full: scorePhq9,
  gad7_full: scoreGad7,
});

const fillObject = (keys, value) => Object.fromEntries(keys.map((key, index) => [key, typeof value === 'function' ? value(key, index) : value]));

const FIXTURE_BUILDERS = Object.freeze({
  odi: () => ({ section_scores: fillObject(numericKeys(10), 2) }),
  fma: () => ({ item_scores: fillObject(FMA_SECTIONS.flatMap(({ section, count }) => Array.from({ length: count }, (_, index) => `${section}_${index}`)), 1) }),
  sarc_f: () => ({ responses: fillObject(['1', '2', '3', '4', '5'], 1) }),
  ndi: () => ({ responses: fillObject(numericKeys(10), 2) }),
  k10_full: () => ({ responses: Array(10).fill(3) }),
  hoos_full: () => ({ responses: fillObject(Object.values(HOOS_SUBSCALES).flat(), 2) }),
  koos_full: () => ({ responses: fillObject(Object.values(KOOS_SUBSCALES).flat(), 2) }),
  fiqr: () => ({ function_scores: Array(9).fill(5), overall_scores: [5, 6], symptom_scores: Array(10).fill(5) }),
  wpi: () => ({
    pain_region_responses: fillObject(numericKeys(WPI_REGIONS.length), (_, index) => [0, 1, 6, 18].includes(index)),
    pain_regions: ['Left jaw', 'Right jaw', 'Left lower arm', 'Abdomen'],
    sss_fatigue: 1, sss_waking: 2, sss_cognitive: 1, sss_somatic: 1,
  }),
  pcs: () => ({ responses: fillObject(rangeKeys('q', 13), 2) }),
  dsq2: () => ({ frequency_ratings: Array(56).fill(2), severity_ratings: Array(56).fill(2) }),
  chalder_fatigue: () => ({ responses: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1] }),
  sf36: () => ({ responses: fillObject(Object.keys(SF36_ALLOWED_MAX), (key) => Math.min(2, SF36_ALLOWED_MAX[key])) }),
  fss: () => ({ responses: Array(9).fill(4) }),
  promis_fatigue: () => ({ raw_score: 24 }),
  psqi: () => ({
    bedtime: '10:30 PM', wake_time: '6:30 AM', bed_hours: 8,
    q2min: 1, q5a: 1, q4hrs: 1,
    q5b: 1, q5c: 1, q5d: 0, q5e: 0, q5f: 0, q5g: 1, q5h: 0, q5i: 1, q5j: 0,
    q6: 0, q7: 1, q8: 1, q9: 1,
  }),
  dgi_full: () => ({ tasks: PROM_NEURO_DGI_TASKS.map(({ name }) => ({ name, score: 2 })) }),
  fga: () => ({ item_scores: fillObject(FGA_KEYS, 2) }),
  parq: () => ({ answers: fillObject(numericKeys(7), (_, index) => index === 2 ? 'yes' : 'no'), other_reasons: '' }),
  gas: () => ({ goals: [{ goal: 'Walk to local shops independently', importance: 2, difficulty: 2, attainmentLevel: 1 }] }),
  psfs: () => ({ activities: [{ name: 'Walk for groceries', score: 6 }, { name: 'Use stairs', score: 5 }] }),
  lefs: () => ({ item_scores: fillObject(numericKeys(20), 2) }),
  himat_full: () => ({ scores: fillObject(Object.keys(HIMAT_MAX), (key) => Math.ceil(HIMAT_MAX[key] / 2)) }),
  aqol: () => ({ responses: fillObject(rangeKeys('aqol', 12), 1) }),
  spadi: () => ({ pain_scores: fillObject(numericKeys(5), 4), disability_scores: fillObject(numericKeys(8), 5) }),
  breq: () => ({ responses: fillObject(rangeKeys('', 19), 2) }),
  pase: () => ({ leisure_responses: fillObject(Object.keys(PASE_LEISURE), 2), household_responses: fillObject(Object.keys(PASE_HOUSEHOLD), (_, index) => index % 2 === 0), work_done: true, work_hours: 2, work_type: 'Mostly standing/walking' }),
  qbpds: () => ({ total_score: 45 }),
  womac: () => ({ item_scores: fillObject([...rangeKeys('pain_', 5, 0), ...rangeKeys('stiffness_', 2, 0), ...rangeKeys('function_', 17, 0)], 2), joint: 'knee', side: 'right' }),
  stroop: () => ({ trial1: { time: 30, completed: 20, errors: 1, selfCorrections: 1 }, trial2: { time: 36, completed: 20, errors: 2, selfCorrections: 1 }, trial3: { time: 45, completed: 20, errors: 3, selfCorrections: 1 } }),
  digit_span: () => ({ forward_trials: [{ length: 5, sequence: [1, 8, 4, 6, 3], response: '18463', correct: true }, { length: 6, sequence: [2, 9, 1, 7, 4, 5], response: '291745', correct: false }], backward_trials: [{ length: 4, sequence: [3, 8, 1, 6], response: '6183', correct: true }] }),
  mas: () => ({ muscles: [{ muscle: 'Right elbow flexors', score: 2 }, { muscle: 'Right plantar flexors', score: '1+' }] }),
  tardieu: () => ({
    header: {
      diagnosis: 'Stroke',
      side_tested: 'Right',
      limb_tested: 'Lower Limb',
      position: 'Supine',
      clinician_notes: '',
    },
    entries: [{
      muscle_group: 'Hamstrings',
      side: 'Right',
      position: 'Supine',
      v1: { tardieu_score: '1', r2_angle: 120, clonus_present: false },
      v2: { tardieu_score: '2', r1_angle: 105, clonus_present: false },
      v3: { tardieu_score: '2', r1_angle: 90, clonus_present: false },
      notes: '',
    }],
  }),
  barthel: () => ({ item_scores: { feeding: 5, bathing: 5, grooming: 5, dressing: 5, bowelControl: 5, bladderControl: 5, toiletUse: 5, transfers: 10, mobility: 10, stairs: 5 } }),
  abc_scale: () => ({ activities_responses: Array(16).fill(65) }),
  mas_stroke: () => ({ item_scores: fillObject(MAS_STROKE_KEYS, 3) }),
  rivermead_mobility: () => ({ individual_tasks: fillObject(rangeKeys('', 15), (_, index) => index < 10 ? 1 : 0) }),
  roland: () => ({ items_checked: Array.from({ length: 24 }, (_, index) => index % 4 === 0) }),
  dash: () => ({ responses: Array(30).fill(3) }),
  faam: () => ({ adl_responses: Array(21).fill(3), sports_responses: Array(8).fill(2) }),
  ikdc: () => ({ ikdc_responses: fillObject(Object.keys(IKDC_MAX), (key) => Math.ceil(IKDC_MAX[key] / 2)) }),
  cat: () => ({ responses: fillObject(['cough', 'phlegm', 'chestTightness', 'breathlessness', 'activities', 'confidence', 'sleep', 'energy'], 2) }),
  ccq: () => ({ responses: fillObject(numericKeys(10), 2) }),
  lcq: () => ({ responses: fillObject(Object.values(LCQ_DOMAINS).flat(), 4) }),
  cbm_full: () => ({ scores: fillObject(CBM_TASKS, 3) }),
  bestest_full: () => ({ item_scores: fillObject(BESTEST_KEYS, 2), version: 'full' }),
  fesi: () => ({ responses: Array(16).fill(2) }),
  ems_full: () => ({ item_scores: fillObject(EMS_KEYS, 2) }),
  pcl5: () => ({ raw_responses: fillObject(rangeKeys('', 20), 2) }),
  isi: () => ({ responses: fillObject(rangeKeys('q', 7), 2) }),
  pediatric_balance: () => ({ scores: Array(14).fill(2) }),
  ppt_full: () => ({ version: '7-item', assessor_name: 'Clinician A', taskScores: fillObject(PPT_TASKS['7-item'], 2), taskTimes: { task_7_walk: 12.5 }, taskNotes: {}, gait_aid_used: false, safe_to_proceed: true, supervision_level: 'independent', safety_concerns: [] }),
  phq9_full: () => ({ responses: Array(9).fill(1), functional_impairment: 'Somewhat difficult' }),
  gad7_full: () => ({ responses: Array(7).fill(1), functional_impairment: 'Somewhat difficult' }),
});

export function buildFixture(canonicalOrRunnerKey) {
  const key = String(canonicalOrRunnerKey ?? '').trim().toLowerCase();
  const builder = FIXTURE_BUILDERS[key];
  if (!builder) throw new Error(`Unsupported Extras PROM/neuro scorer fixture: ${canonicalOrRunnerKey}`);
  return cleanClone({ runnerKey: key, ...builder(), notes: '' });
}

export function validateAndScore(input, context = {}) {
  const key = String(context.runnerKey || context.scoringKey || input?.runnerKey || input?.scoringKey || input?.runner_key || input?.scoring_key || '').trim().toLowerCase();
  const scorer = PROM_NEURO_SCORERS[key];
  if (!scorer) throw new Error(`Extras PROM/neuro scorer requires one of: ${PROM_NEURO_RUNNER_KEYS.join(', ')}`);
  return scorer(input, { ...context, runnerKey: key });
}
