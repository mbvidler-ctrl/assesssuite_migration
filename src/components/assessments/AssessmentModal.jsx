import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Download, Plus, BookOpen, Eye, Edit, CheckCircle, XCircle } from "lucide-react";
import { Toaster, toast } from "sonner";
import ClickableReferences from "./ClickableReferences";
import TestRunner from "./TestRunner";
import QuestionnaireRunner from "./QuestionnaireRunner";
import EditAssessmentModal from "./EditAssessmentModal";
import EditQualityChecksModal from "./EditQualityChecksModal";
import AssessmentTestRunnerRouter from "./AssessmentTestRunnerRouter";
import { base44 } from "@/api/base44Client";
export default function AssessmentModal({ assessment, onClose, onAddToClient, clientId, onRunTest }) {
  const [showTestRunner, setShowTestRunner] = useState(false);
  const [tempClientAssessment, setTempClientAssessment] = useState(null);
  const [showQuestionnaireRunner, setShowQuestionnaireRunner] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditQualityChecks, setShowEditQualityChecks] = useState(false);
  const [currentAssessment, setCurrentAssessment] = useState(assessment);
  const scrollContainerRef = useRef(null);
  const topSentinelRef = useRef(null);

  useEffect(() => {
    if (topSentinelRef.current) {
      topSentinelRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
      
      // Backup scroll to ensure it happens
      setTimeout(() => {
        if (topSentinelRef.current) {
          topSentinelRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      }, 50);
    }
  }, [assessment?.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const formatCategory = (category) => {
    return category.replace(/_/g, ' & ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getCategoryColor = (category) => {
    const colors = {
      musculoskeletal: 'bg-blue-100 text-blue-800',
      neurological: 'bg-purple-100 text-purple-800',
      cardio_pulmonary: 'bg-red-100 text-red-800',
      metabolic: 'bg-green-100 text-green-800',
      mental_health: 'bg-yellow-100 text-yellow-800',
      pediatric: 'bg-pink-100 text-pink-800',
      geriatric: 'bg-orange-100 text-orange-800',
      general: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.general;
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getAssessmentQuestions = (assessmentName) => {
    const assessmentQuestions = {
      'Berg Balance Scale': `
<h3>Berg Balance Scale - 14 Item Assessment</h3>
<ol>
<li><strong>Sitting to Standing</strong><br/>
Instructions: Please stand up. Try not to use your hands for support.<br/>
Grading:<br/>
4 = able to stand without using hands and stabilize independently<br/>
3 = able to stand independently using hands<br/>
2 = able to stand using hands after several tries<br/>
1 = needs minimal aid to stand or stabilize<br/>
0 = needs moderate or maximal assist to stand<br/>
Score: ___/4</li>

<li><strong>Standing Unsupported</strong><br/>
Instructions: Please stand for two minutes without holding on.<br/>
Grading:<br/>
4 = able to stand safely for 2 minutes<br/>
3 = able to stand 2 minutes with supervision<br/>
2 = able to stand 30 seconds unsupported<br/>
1 = needs several tries to stand 30 seconds unsupported<br/>
0 = unable to stand 30 seconds unassisted<br/>
Score: ___/4</li>

<li><strong>Sitting with Back Unsupported but Feet Supported on Floor or on a Stool</strong><br/>
Instructions: Please sit with arms folded for 2 minutes.<br/>
Grading:<br/>
4 = able to sit safely and securely for 2 minutes<br/>
3 = able to sit 2 minutes under supervision<br/>
2 = able to sit 30 seconds<br/>
1 = able to sit 10 seconds<br/>
0 = unable to sit without support 10 seconds<br/>
Score: ___/4</li>

<li><strong>Standing to Sitting</strong><br/>
Instructions: Please sit down.<br/>
Grading:<br/>
4 = sits safely with minimal use of hands<br/>
3 = controls descent by using hands<br/>
2 = uses back of legs against chair to control descent<br/>
1 = sits independently but has uncontrolled descent<br/>
0 = needs assist to sit<br/>
Score: ___/4</li>

<li><strong>Transfers</strong><br/>
Instructions: Arrange chair(s) for pivot transfer. Ask subject to transfer one way toward a seat with armrests and one way toward a seat without armrests.<br/>
Grading:<br/>
4 = able to transfer safely with minor use of hands<br/>
3 = able to transfer safely definite need of hands<br/>
2 = able to transfer with verbal cuing and/or supervision<br/>
1 = needs one person to assist<br/>
0 = needs two people to assist or supervise to be safe<br/>
Score: ___/4</li>

<li><strong>Standing Unsupported with Eyes Closed</strong><br/>
Instructions: Please close your eyes and stand still for 10 seconds.<br/>
Grading:<br/>
4 = able to stand 10 seconds safely<br/>
3 = able to stand 10 seconds with supervision<br/>
2 = able to stand 3 seconds<br/>
1 = unable to keep eyes closed 3 seconds but stays steady<br/>
0 = needs help to keep from falling<br/>
Score: ___/4</li>

<li><strong>Standing Unsupported with Feet Together</strong><br/>
Instructions: Place your feet together and stand without holding on.<br/>
Grading:<br/>
4 = able to place feet together independently and stand 1 minute safely<br/>
3 = able to place feet together independently and stand 1 minute with supervision<br/>
2 = able to place feet together independently but unable to hold for 30 seconds<br/>
1 = needs help to attain position but able to stand 15 seconds feet together<br/>
0 = needs help to attain position and unable to hold for 15 seconds<br/>
Score: ___/4</li>

<li><strong>Reaching Forward with Outstretched Arm While Standing</strong><br/>
Instructions: Lift arm to 90 degrees. Stretch out your fingers and reach forward as far as you can. (Examiner places a ruler at the end of fingertips when arm is at 90 degrees.)<br/>
Grading:<br/>
4 = can reach forward confidently 25 cm (10 inches)<br/>
3 = can reach forward 12.5 cm (5 inches)<br/>
2 = can reach forward 5 cm (2 inches)<br/>
1 = reaches forward but needs supervision<br/>
0 = loses balance while trying/requires external support<br/>
Score: ___/4</li>

<li><strong>Pick up Object from the Floor from a Standing Position</strong><br/>
Instructions: Pick up the shoe/slipper, which is in front of your feet.<br/>
Grading:<br/>
4 = able to pick up slipper safely and easily<br/>
3 = able to pick up slipper but needs supervision<br/>
2 = unable to pick up but reaches 2-5 cm from slipper and keeps balance independently<br/>
1 = unable to pick up and needs supervision while trying<br/>
0 = unable to try/needs assist to keep from falling<br/>
Score: ___/4</li>

<li><strong>Turning to Look Behind Over Left and Right Shoulders While Standing</strong><br/>
Instructions: Turn to look directly behind you over toward the left shoulder. Repeat to the right.<br/>
Grading:<br/>
4 = looks behind from both sides and weight shifts well<br/>
3 = looks behind one side only other side shows less weight shift<br/>
2 = turns sideways only but maintains balance<br/>
1 = needs supervision when turning<br/>
0 = needs assist to keep from falling<br/>
Score: ___/4</li>

<li><strong>Turn 360 Degrees</strong><br/>
Instructions: Turn completely around in a full circle. Pause. Then turn a full circle in the other direction.<br/>
Grading:<br/>
4 = able to turn 360 degrees safely in 4 seconds or less<br/>
3 = able to turn 360 degrees safely one side only 4 seconds or less<br/>
2 = able to turn 360 degrees safely but slowly<br/>
1 = needs close supervision or verbal cuing<br/>
0 = needs assistance while turning<br/>
Score: ___/4</li>

<li><strong>Placing Alternate Foot on Step or Stool While Standing Unsupported</strong><br/>
Instructions: Place each foot alternately on the step/stool. Continue until each foot has touched the step/stool four times.<br/>
Grading:<br/>
4 = able to stand independently and safely and complete 8 steps in 20 seconds<br/>
3 = able to stand independently and complete 8 steps in more than 20 seconds<br/>
2 = able to complete 4 steps without aid with supervision<br/>
1 = able to complete more than 2 steps needs minimal assist<br/>
0 = needs assistance to keep from falling/unable to try<br/>
Score: ___/4</li>

<li><strong>Standing Unsupported One Foot in Front</strong><br/>
Instructions: Place one foot directly in front of the other. If you feel that you cannot place your foot directly in front, try to step far enough ahead that the heel of your forward foot is ahead of the toes of the other foot.<br/>
Grading:<br/>
4 = able to place foot tandem independently and hold 30 seconds<br/>
3 = able to place foot ahead independently and hold 30 seconds<br/>
2 = able to take small step independently and hold 30 seconds<br/>
1 = needs help to step but can hold 15 seconds<br/>
0 = loses balance while stepping or standing<br/>
Score: ___/4</li>

<li><strong>Standing on One Foot</strong><br/>
Instructions: Stand on one foot as long as you can without holding on.<br/>
Grading:<br/>
4 = able to lift leg independently and hold more than 10 seconds<br/>
3 = able to lift leg independently and hold 5-10 seconds<br/>
2 = able to lift leg independently and hold ≥ 3 seconds<br/>
1 = tries to lift leg unable to hold 3 seconds but remains standing independently<br/>
0 = unable to try or needs assist to prevent fall<br/>
Score: ___/4</li>
</ol>
<p><strong>TOTAL SCORE: ___/56</strong></p>
<p><strong>INTERPRETATION:</strong><br/>
• 41-56 = low fall risk<br/>
• 21-40 = medium fall risk<br/>
• 0-20 = high fall risk</p>`,

      'Timed Up and Go (TUG)': `
<h3>Timed Up and Go (TUG) Test</h3>
<p><strong>Equipment Required:</strong> Standard armchair, stopwatch, 3-meter walkway, cone or marker</p>

<h4>Instructions:</h4>
<ol>
<li>Have the patient sit in a standard armchair with their back against the chair</li>
<li>Place a cone or marker exactly 3 meters (10 feet) away from the chair</li>
<li>Instruct the patient: "When I say GO, I want you to stand up from the chair, walk to the line on the floor at your normal pace, turn around, walk back to the chair at your normal pace, and sit down again"</li>
<li>Demonstrate the task if necessary</li>
<li>Allow one practice trial if needed</li>
<li>Time the patient from the moment they start to rise from the chair until they are seated again with their back against the chair</li>
</ol>

<h4>Scoring:</h4>
<p><strong>Time: _____ seconds</strong></p>

<h4>Interpretation:</h4>
<ul>
<li><strong>&lt; 10 seconds:</strong> Normal mobility, low fall risk</li>
<li><strong>10-20 seconds:</strong> Good mobility, minimal fall risk</li>
<li><strong>20-30 seconds:</strong> Problems with mobility, moderate fall risk</li>
<li><strong>&gt; 30 seconds:</strong> Severe mobility problems, high fall risk</li>
</ul>

<h4>Safety Notes:</h4>
<p>Stay close to the patient throughout the test. Stop the test if the patient appears unsteady or at risk of falling.</p>

<h4>Additional Observations:</h4>
<p><strong>Gait pattern:</strong> ____________________</p>
<p><strong>Balance issues noted:</strong> ____________________</p>
<p><strong>Use of assistive device:</strong> ____________________</p>`,

      'Hand Grip Strength': `
<h3>Hand Grip Strength Test</h3>
<p><strong>Equipment Required:</strong> Calibrated hand dynamometer (Jamar or equivalent)</p>

<h4>Pre-Test Setup:</h4>
<ol>
<li>Calibrate the dynamometer according to manufacturer instructions</li>
<li>Adjust the handle to fit the patient's hand size (usually position 2 for most adults)</li>
<li>Have the patient remove any jewelry from hands/wrists</li>
</ol>

<h4>Test Position:</h4>
<ul>
<li>Patient seated in chair with back supported</li>
<li>Feet flat on floor</li>
<li>Shoulder adducted and neutrally rotated</li>
<li>Elbow flexed at 90 degrees</li>
<li>Forearm in neutral position</li>
<li>Wrist between 0-30 degrees extension and 0-15 degrees ulnar deviation</li>
</ul>

<h4>Instructions to Patient:</h4>
<p>"I want you to squeeze the handle as hard as you can. Take a deep breath and squeeze as hard as possible for 3 seconds. Ready? Squeeze!"</p>

<h4>Testing Protocol:</h4>
<ol>
<li>Test dominant hand first, then non-dominant</li>
<li>Perform 3 trials for each hand</li>
<li>Rest 15 seconds between trials</li>
<li>Rest 1 minute between hands</li>
<li>Provide strong verbal encouragement</li>
<li>Record all results</li>
</ol>

<h4>Results:</h4>
<table border="1" cellpadding="5">
<tr><th>Hand</th><th>Trial 1 (kg)</th><th>Trial 2 (kg)</th><th>Trial 3 (kg)</th><th>Best (kg)</th></tr>
<tr><td>Dominant: _______</td><td>____</td><td>____</td><td>____</td><td>____</td></tr>
<tr><td>Non-Dominant: _______</td><td>____</td><td>____</td><td>____</td><td>____</td></tr>
</table>

<h4>Age/Gender Norms (kg):</h4>
<table border="1" cellpadding="5">
<tr><th>Age</th><th>Male Dominant</th><th>Female Dominant</th></tr>
<tr><td>20-24</td><td>54.5</td><td>32.9</td></tr>
<tr><td>25-29</td><td>54.4</td><td>33.8</td></tr>
<tr><td>30-34</td><td>54.1</td><td>33.4</td></tr>
<tr><td>35-39</td><td>52.9</td><td>32.2</td></tr>
<tr><td>40-44</td><td>52.2</td><td>31.1</td></tr>
<tr><td>45-49</td><td>50.7</td><td>29.9</td></tr>
<tr><td>50-54</td><td>48.0</td><td>28.7</td></tr>
<tr><td>55-59</td><td>45.9</td><td>27.2</td></tr>
<tr><td>60-64</td><td>43.4</td><td>25.3</td></tr>
<tr><td>65-69</td><td>41.0</td><td>23.5</td></tr>
<tr><td>70-75</td><td>37.2</td><td>21.4</td></tr>
</table>`,

      '6 Minute Walk Test': `
<h3>6 Minute Walk Test (6MWT)</h3>
<p><strong>Equipment Required:</strong> Stopwatch, measuring wheel, cones, chairs, clipboard, oxygen saturation monitor (if available)</p>

<h4>Course Setup:</h4>
<ul>
<li>30-meter straight corridor (minimum acceptable: 15 meters)</li>
<li>Mark turnaround points with cones</li>
<li>Mark every 3 meters along the course</li>
<li>Place chair at starting point and halfway point</li>
</ul>

<h4>Pre-Test Measurements:</h4>
<table border="1" cellpadding="5">
<tr><td>Resting Heart Rate:</td><td>_____ bpm</td></tr>
<tr><td>Resting Blood Pressure:</td><td>_____/_____</td></tr>
<tr><td>Resting SpO2:</td><td>_____%</td></tr>
<tr><td>Resting RPE (0-10):</td><td>_____</td></tr>
</table>

<h4>Instructions to Patient:</h4>
<p>"The object of this test is to walk as far as possible for 6 minutes. You will walk back and forth in this hallway. Six minutes is a long time to walk, so you will be exerting yourself. You are permitted to slow down, to stop, and to rest as necessary. You may lean against the wall if you like. The important thing is to walk as much as possible for the full 6 minutes."</p>

<p>"I'm going to use this stopwatch to keep track of the 6 minutes. I will let you know as we go along how you are doing and how much time you have left. When I tell you to stop, just stop right where you are and I will come to you."</p>

<h4>During the Test:</h4>
<ul>
<li>Start timer as patient begins first step</li>
<li>Walk behind patient</li>
<li>Give standardized encouragement every 2 minutes</li>
<li>Count laps using lap counter or tally sheet</li>
<li>Do not talk to patient except for encouragement</li>
</ul>

<h4>Standardized Encouragement Phrases:</h4>
<ul>
<li>After 1 minute: "You are doing well. You have 5 minutes to go."</li>
<li>After 2 minutes: "Keep up the good work. You have 4 minutes to go."</li>
<li>After 3 minutes: "You are doing well. You are halfway done."</li>
<li>After 4 minutes: "Keep up the good work. You have only 2 minutes left."</li>
<li>After 5 minutes: "You are doing well. You have only 1 minute to go."</li>
</ul>

<h4>Stopping Criteria:</h4>
<ul>
<li>Chest pain</li>
<li>Intolerable dyspnea</li>
<li>Leg cramps</li>
<li>Staggering</li>
<li>Diaphoresis</li>
<li>Pale or ashen appearance</li>
</ul>

<h4>Results:</h4>
<table border="1" cellpadding="5">
<tr><td>Total Distance Walked:</td><td>_____ meters</td></tr>
<tr><td>Number of Rests:</td><td>_____</td></tr>
<tr><td>Total Rest Time:</td><td>_____ minutes</td></tr>
</table>

<h4>Post-Test Measurements (immediately after):</h4>
<table border="1" cellpadding="5">
<tr><td>Heart Rate:</td><td>_____ bpm</td></tr>
<tr><td>SpO2:</td><td>_____%</td></tr>
<tr><td>RPE (0-10):</td><td>_____</td></tr>
<tr><td>Dyspnea (0-10):</td><td>_____</td></tr>
</table>

<h4>Predicted Distance Formulas:</h4>
<p><strong>Men:</strong> (7.57 × height cm) - (5.02 × age) - (1.76 × weight kg) - 309 meters</p>
<p><strong>Women:</strong> (2.11 × height cm) - (2.29 × weight kg) - (5.78 × age) + 667 meters</p>

<p><strong>% Predicted:</strong> _____%</p>`,

      'Kessler Psychological Distress Scale (K10)': `
<h3>Kessler Psychological Distress Scale (K10)</h3>
<p><strong>Instructions:</strong> The following questions ask about how you have been feeling during the past 30 days. For each question, please circle the number that best describes how often you had this feeling.</p>

<table border="1" cellpadding="5">
<tr>
<th>During the past 30 days, about how often did you feel...</th>
<th>None of the time (1)</th>
<th>A little of the time (2)</th>
<th>Some of the time (3)</th>
<th>Most of the time (4)</th>
<th>All of the time (5)</th>
</tr>
<tr><td>1. Tired out for no good reason?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
<tr><td>2. Nervous?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
<tr><td>3. So nervous that nothing could calm you down?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
<tr><td>4. Hopeless?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
<tr><td>5. Restless or fidgety?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
<tr><td>6. So restless you could not sit still?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
<tr><td>7. Depressed?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
<tr><td>8. That everything was an effort?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
<tr><td>9. So sad that nothing could cheer you up?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
<tr><td>10. Worthless?</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
</table>

<h4>Scoring:</h4>
<p><strong>Total Score: _____ /50</strong></p>

<h4>Interpretation:</h4>
<ul>
<li><strong>10-15:</strong> Likely to be well</li>
<li><strong>16-21:</strong> Likely to have a mild mental disorder</li>
<li><strong>22-29:</strong> Likely to have a moderate mental disorder</li>
<li><strong>30-50:</strong> Likely to have a severe mental disorder</li>
</ul>

<h4>Clinical Notes:</h4>
<p>_________________________________________________</p>
<p>_________________________________________________</p>
<p>_________________________________________________</p>`,

      'PHQ-9': `
<h3>Patient Health Questionnaire-9 (PHQ-9)</h3>
<p><strong>Instructions:</strong> Over the last 2 weeks, how often have you been bothered by any of the following problems?</p>

<table border="1" cellpadding="5">
<tr>
<th>Over the last 2 weeks, how often have you been bothered by any of the following problems?</th>
<th>Not at all (0)</th>
<th>Several days (1)</th>
<th>More than half the days (2)</th>
<th>Nearly every day (3)</th>
</tr>
<tr><td>1. Little interest or pleasure in doing things</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>2. Feeling down, depressed, or hopeless</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>3. Trouble falling or staying asleep, or sleeping too much</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>4. Feeling tired or having little energy</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>5. Poor appetite or overeating</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>6. Feeling bad about yourself — or that you are a failure or have let yourself or your family down</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>7. Trouble concentrating on things, such as reading the newspaper or watching television</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>8. Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>9. Thoughts that you would be better off dead or of hurting yourself in some way</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
</table>

<h4>Scoring:</h4>
<p><strong>Total Score: _____ /27</strong></p>

<h4>Depression Severity:</h4>
<ul>
<li><strong>0-4:</strong> Minimal depression</li>
<li><strong>5-9:</strong> Mild depression</li>
<li><strong>10-14:</strong> Moderate depression</li>
<li><strong>15-19:</strong> Moderately severe depression</li>
<li><strong>20-27:</strong> Major depression</li>
</ul>

<h4>Functional Assessment:</h4>
<p>If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?</p>
<ul>
<li>â˜ Not difficult at all</li>
<li>â˜ Somewhat difficult</li>
<li>â˜ Very difficult</li>
<li>â˜ Extremely difficult</li>
</ul>

<h4>Suicide Risk Assessment:</h4>
<p><strong>Question 9 Score: _____</strong></p>
<p>If patient scored ≥1 on question 9, immediate risk assessment required.</p>

<h4>Clinical Notes:</h4>
<p>_________________________________________________</p>
<p>_________________________________________________</p>`,

      'GAD-7': `
<h3>Generalized Anxiety Disorder 7-item (GAD-7)</h3>
<p><strong>Instructions:</strong> Over the last 2 weeks, how often have you been bothered by the following problems?</p>

<table border="1" cellpadding="5">
<tr>
<th>Over the last 2 weeks, how often have you been bothered by the following problems?</th>
<th>Not at all (0)</th>
<th>Several days (1)</th>
<th>More than half the days (2)</th>
<th>Nearly every day (3)</th>
</tr>
<tr><td>1. Feeling nervous, anxious or on edge</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>2. Not being able to stop or control worrying</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>3. Worrying too much about different things</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>4. Trouble relaxing</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>5. Being so restless that it is hard to sit still</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>6. Becoming easily annoyed or irritable</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><td>7. Feeling afraid as if something awful might happen</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
</table>

<h4>Scoring:</h4>
<p><strong>Total Score: _____ /21</strong></p>

<h4>Anxiety Severity:</h4>
<ul>
<li><strong>0-4:</strong> Minimal anxiety</li>
<li><strong>5-9:</strong> Mild anxiety</li>
<li><strong>10-14:</strong> Moderate anxiety</li>
<li><strong>15-21:</strong> Severe anxiety</li>
</ul>

<h4>Functional Assessment:</h4>
<p>If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?</p>
<ul>
<li>â˜ Not difficult at all</li>
<li>â˜ Somewhat difficult</li>
<li>â˜ Very difficult</li>
<li>â˜ Extremely difficult</li>
</ul>

<h4>Clinical Notes:</h4>
<p>_________________________________________________</p>
<p>_________________________________________________</p>`,

      '2-Minute Step Test': `
<h3>2-Minute Step Test</h3>
<p><strong>Equipment Required:</strong> Stopwatch, measuring tape, marker/tape</p>

<h4>Setup:</h4>
<ol>
<li>Measure the participant's knee height while seated</li>
<li>Mark this height on a wall or use a string/tape as a reference</li>
<li>The step height should be midway between the kneecap and iliac crest when standing</li>
</ol>

<h4>Instructions to Participant:</h4>
<p>"This test involves stepping in place for 2 minutes. Step by bringing your knees up to the height of this mark. If you cannot maintain the required knee height, slow down rather than lowering your knees. You may rest if needed, but remain standing. Try to do as many steps as possible in 2 minutes."</p>

<h4>Test Protocol:</h4>
<ol>
<li>Demonstrate the proper stepping technique</li>
<li>Have participant practice for 5-10 seconds</li>
<li>Allow 1 minute rest before beginning test</li>
<li>Count steps when knee reaches the required height</li>
<li>Count only the right knee steps (left knee can be counted if easier to see)</li>
<li>Provide encouragement throughout</li>
</ol>

<h4>During Test - Count Only Steps That Meet Height Requirement:</h4>
<table border="1" cellpadding="5">
<tr><th>Time Interval</th><th>Step Count</th><th>Cumulative Total</th></tr>
<tr><td>0-30 seconds</td><td>_____</td><td>_____</td></tr>
<tr><td>30-60 seconds</td><td>_____</td><td>_____</td></tr>
<tr><td>60-90 seconds</td><td>_____</td><td>_____</td></tr>
<tr><td>90-120 seconds</td><td>_____</td><td>_____</td></tr>
</table>

<h4>Results:</h4>
<p><strong>Total Steps in 2 Minutes: _____</strong></p>

<h4>Age-Based Norms:</h4>
<table border="1" cellpadding="5">
<tr><th>Age Group</th><th>Men - Average</th><th>Women - Average</th></tr>
<tr><td>60-64</td><td>107-120</td><td>100-115</td></tr>
<tr><td>65-69</td><td>101-116</td><td>95-110</td></tr>
<tr><td>70-74</td><td>93-109</td><td>87-102</td></tr>
<tr><td>75-79</td><td>86-102</td><td>79-95</td></tr>
<tr><td>80-84</td><td>79-95</td><td>73-88</td></tr>
<tr><td>85-89</td><td>71-87</td><td>67-82</td></tr>
<tr><td>90-94</td><td>65-81</td><td>60-75</td></tr>
</table>

<h4>Observations:</h4>
<p><strong>Fatigue level:</strong> ________________</p>
<p><strong>Balance issues:</strong> ________________</p>
<p><strong>Breathing:</strong> ________________</p>
<p><strong>Other notes:</strong> ________________</p>`,

      '30-Second Sit to Stand Test': `
<h3>30-Second Sit to Stand Test</h3>
<p><strong>Equipment Required:</strong> Stopwatch, straight-back chair (seat height 17 inches/43 cm), no arms</p>

<h4>Setup:</h4>
<ul>
<li>Place chair against wall for stability</li>
<li>Ensure adequate space in front of chair</li>
<li>Have participant wear appropriate footwear</li>
</ul>

<h4>Starting Position:</h4>
<ul>
<li>Participant sits in middle of chair</li>
<li>Back straight against chair back</li>
<li>Feet flat on floor, shoulder-width apart</li>
<li>Arms crossed over chest, hands on shoulders</li>
</ul>

<h4>Instructions to Participant:</h4>
<p>"On the word 'GO', rise to a full standing position, then sit back down, and repeat this for 30 seconds. Sit down completely between each stand. Move at your own pace and try to complete as many full stands as possible in 30 seconds. Keep your arms crossed over your chest throughout the test."</p>

<h4>Test Protocol:</h4>
<ol>
<li>Demonstrate the movement once</li>
<li>Have participant perform 1-2 practice repetitions</li>
<li>Check that arms remain crossed throughout</li>
<li>Count each complete stand (buttocks clear the chair)</li>
<li>Provide encouragement during test</li>
<li>Stop at exactly 30 seconds</li>
</ol>

<h4>Safety Considerations:</h4>
<ul>
<li>Stay close to participant</li>
<li>Have chair secured against wall</li>
<li>Stop test if participant shows signs of distress</li>
<li>Allow use of arms if balance is compromised (note this)</li>
</ul>

<h4>Counting:</h4>
<table border="1" cellpadding="5">
<tr><th>Time Interval</th><th>Number of Stands</th><th>Cumulative Total</th></tr>
<tr><td>0-10 seconds</td><td>_____</td><td>_____</td></tr>
<tr><td>10-20 seconds</td><td>_____</td><td>_____</td></tr>
<tr><td>20-30 seconds</td><td>_____</td><td>_____</td></tr>
</table>

<h4>Results:</h4>
<p><strong>Total Number of Stands in 30 Seconds: _____</strong></p>

<h4>Age-Based Norms:</h4>
<table border="1" cellpadding="5">
<tr><th>Age Group</th><th>Men - Average (Range)</th><th>Women - Average (Range)</th></tr>
<tr><td>60-64</td><td>14 (12-17)</td><td>12 (10-15)</td></tr>
<tr><td>65-69</td><td>12 (10-15)</td><td>11 (9-14)</td></tr>
<tr><td>70-74</td><td>12 (9-14)</td><td>10 (8-13)</td></tr>
<tr><td>75-79</td><td>11 (8-14)</td><td>10 (7-12)</td></tr>
<tr><td>80-84</td><td>10 (7-12)</td><td>9 (6-11)</td></tr>
<tr><td>85-89</td><td>8 (5-11)</td><td>8 (5-10)</td></tr>
<tr><td>90-94</td><td>7 (4-9)</td><td>4 (2-7)</td></tr>
</table>

<h4>Performance Categories:</h4>
<ul>
<li><strong>Above Average:</strong> Score above the age-group range</li>
<li><strong>Average:</strong> Score within the age-group range</li>
<li><strong>Below Average:</strong> Score below the age-group range</li>
</ul>

<h4>Clinical Notes:</h4>
<p><strong>Use of arms:</strong> â˜ Yes â˜ No</p>
<p><strong>Balance issues:</strong> ________________</p>
<p><strong>Fatigue level:</strong> ________________</p>
<p><strong>Other observations:</strong> ________________</p>`,

      'Four-Stage Balance Test': `
<h3>Four-Stage Balance Test</h3>
<p><strong>Equipment Required:</strong> Stopwatch</p>

<h4>General Instructions:</h4>
<ul>
<li>Each position should be held for 10 seconds</li>
<li>If participant cannot hold position for 10 seconds, note the time achieved</li>
<li>Stop test if participant becomes unsteady</li>
<li>Stay close to participant for safety</li>
<li>Participant should not use assistive devices</li>
</ul>

<h4>Stage 1: Side-by-Side Stand</h4>
<p><strong>Instructions:</strong> "Stand with your feet side by side, touching each other. I will time you for up to 10 seconds."</p>
<p><strong>Time held: _____ seconds (up to 10)</strong></p>
<p>â˜ Held for full 10 seconds â˜ Could not hold for 10 seconds</p>
<p><em>If unable to hold for 10 seconds, STOP TEST</em></p>

<h4>Stage 2: Semi-Tandem Stand</h4>
<p><strong>Instructions:</strong> "Place the heel of one foot beside the big toe of your other foot. You may put either foot forward. I will time you for up to 10 seconds."</p>
<p><strong>Time held: _____ seconds (up to 10)</strong></p>
<p>â˜ Held for full 10 seconds â˜ Could not hold for 10 seconds</p>
<p><em>If unable to hold for 10 seconds, STOP TEST</em></p>

<h4>Stage 3: Tandem Stand</h4>
<p><strong>Instructions:</strong> "Place one foot directly in front of the other, heel touching toe. You may put either foot forward. I will time you for up to 10 seconds."</p>
<p><strong>Time held: _____ seconds (up to 10)</strong></p>
<p>â˜ Held for full 10 seconds â˜ Could not hold for 10 seconds</p>
<p><em>If unable to hold for 10 seconds, STOP TEST</em></p>

<h4>Stage 4: One-Leg Stand</h4>
<p><strong>Instructions:</strong> "Stand on one leg for as long as you can. You may choose which leg to stand on. I will time you for up to 10 seconds."</p>
<p><strong>Time held: _____ seconds (up to 10)</strong></p>
<p>â˜ Held for full 10 seconds â˜ Could not hold for 10 seconds</p>

<h4>Overall Results:</h4>
<table border="1" cellpadding="5">
<tr><th>Stage</th><th>Position</th><th>Time (sec)</th><th>Pass/Fail</th></tr>
<tr><td>1</td><td>Side-by-Side</td><td>_____</td><td>_____</td></tr>
<tr><td>2</td><td>Semi-Tandem</td><td>_____</td><td>_____</td></tr>
<tr><td>3</td><td>Tandem</td><td>_____</td><td>_____</td></tr>
<tr><td>4</td><td>One-Leg</td><td>_____</td><td>_____</td></tr>
</table>

<h4>Interpretation:</h4>
<ul>
<li><strong>Stages 1-3 completed:</strong> Good balance</li>
<li><strong>Stage 4 completed:</strong> Excellent balance</li>
<li><strong>Unable to complete Stage 1:</strong> Significant balance impairment</li>
<li><strong>Unable to complete Stage 2:</strong> Moderate balance impairment</li>
<li><strong>Unable to complete Stage 3:</strong> Mild balance impairment</li>
</ul>

<h4>Clinical Notes:</h4>
<p><strong>Preferred stance leg:</strong> â˜ Right â˜ Left</p>
<p><strong>Balance strategies observed:</strong> ________________</p>
<p><strong>Other observations:</strong> ________________</p>`,

      'Single Leg Stance Test': `
<h3>Single Leg Stance Test</h3>
<p><strong>Equipment Required:</strong> Stopwatch</p>

<h4>Setup:</h4>
<ul>
<li>Clear area with stable surface</li>
<li>Remove throw rugs or obstacles</li>
<li>Have chair nearby for support if needed</li>
<li>Participant should wear regular walking shoes</li>
</ul>

<h4>Instructions to Participant:</h4>
<p>"I want you to stand on one leg for as long as you can. Keep your arms at your sides or however is comfortable for you. When I say 'go', lift one leg off the ground and balance on the other leg for as long as possible. I will time you up to 60 seconds."</p>

<h4>Test Protocol:</h4>
<ol>
<li>Test each leg separately - eyes open first, then eyes closed</li>
<li>Demonstrate if necessary</li>
<li>Allow one practice attempt if requested</li>
<li>Position yourself to provide support if needed</li>
<li>Start timing when foot leaves ground</li>
<li>Stop timing when:
   <ul>
   <li>Raised foot touches ground</li>
   <li>Standing foot moves</li>
   <li>Arms or raised leg touch wall/support</li>
   <li>60 seconds elapsed</li>
   </ul>
</li>
</ol>

<h4>Eyes Open Results:</h4>
<table border="1" cellpadding="5">
<tr><th>Leg</th><th>Time (seconds)</th><th>Reason for Stopping</th></tr>
<tr><td><strong>LEFT Leg</strong></td><td>_____ sec (max 60)</td><td>________________</td></tr>
<tr><td><strong>RIGHT Leg</strong></td><td>_____ sec (max 60)</td><td>________________</td></tr>
</table>

<h4>Eyes Closed Results:</h4>
<table border="1" cellpadding="5">
<tr><th>Leg</th><th>Time (seconds)</th><th>Reason for Stopping</th></tr>
<tr><td><strong>LEFT Leg</strong></td><td>_____ sec (max 60)</td><td>________________</td></tr>
<tr><td><strong>RIGHT Leg</strong></td><td>_____ sec (max 60)</td><td>________________</td></tr>
</table>

<h4>Summary:</h4>
<p><strong>Best Eyes Open Time: _____ seconds</strong></p>
<p><strong>Best Eyes Closed Time: _____ seconds</strong></p>
<p><strong>Dominant Leg: â˜ Right â˜ Left</strong></p>
<p><strong>Required Support/Supervision: â˜ Yes â˜ No</strong></p>

<h4>Reason for Stopping (check all that apply):</h4>
<p>â˜ Completed 60 seconds &nbsp;&nbsp; â˜ Hands moved from position</p>
<p>â˜ Supporting foot shifted &nbsp;&nbsp; â˜ Lifted foot touched ground/leg</p>
<p>â˜ Loss of balance &nbsp;&nbsp; â˜ Client chose to stop</p>

<h4>Age-Based Norms (seconds) - Eyes Open:</h4>
<table border="1" cellpadding="5">
<tr><th>Age Group</th><th>Men</th><th>Women</th></tr>
<tr><td>20-49</td><td>43</td><td>41</td></tr>
<tr><td>50-59</td><td>40</td><td>37</td></tr>
<tr><td>60-69</td><td>32</td><td>30</td></tr>
<tr><td>70-79</td><td>22</td><td>19</td></tr>
<tr><td>80+</td><td>9</td><td>8</td></tr>
</table>

<h4>Interpretation:</h4>
<ul>
<li><strong>&lt; 5 seconds:</strong> High fall risk, significant balance impairment</li>
<li><strong>5-10 seconds:</strong> Moderate fall risk</li>
<li><strong>10-20 seconds:</strong> Mild balance issues</li>
<li><strong>&gt; 30 seconds:</strong> Good balance for age</li>
</ul>

<h4>Balance Strategies Observed:</h4>
<p>â˜ Hip strategy (hip movements to maintain balance)</p>
<p>â˜ Ankle strategy (ankle movements to maintain balance)</p>
<p>â˜ Step strategy (stepping to regain balance)</p>
<p>â˜ Upper extremity compensation</p>

<h4>Clinical Notes:</h4>
<p>_________________________________________________</p>
<p>_________________________________________________</p>`,

      'One-Leg Stance Test': `
<h3>One-Leg Stance Test</h3>
<p><strong>Equipment Required:</strong> Stopwatch</p>

<h4>Setup:</h4>
<ul>
<li>Clear area with stable surface</li>
<li>Remove throw rugs or obstacles</li>
<li>Have chair nearby for support if needed</li>
<li>Participant should wear regular walking shoes</li>
</ul>

<h4>Instructions to Participant:</h4>
<p>"I want you to stand on one leg for as long as you can. Keep your arms at your sides or however is comfortable for you. When I say 'go', lift one leg off the ground and balance on the other leg for as long as possible. I will time you up to 60 seconds."</p>

<h4>Test Protocol:</h4>
<ol>
<li>Test each leg separately - eyes open first, then eyes closed</li>
<li>Demonstrate if necessary</li>
<li>Allow one practice attempt if requested</li>
<li>Position yourself to provide support if needed</li>
<li>Start timing when foot leaves ground</li>
<li>Stop timing when:
   <ul>
   <li>Raised foot touches ground</li>
   <li>Standing foot moves</li>
   <li>Arms or raised leg touch wall/support</li>
   <li>60 seconds elapsed</li>
   </ul>
</li>
</ol>

<h4>Eyes Open Results:</h4>
<table border="1" cellpadding="5">
<tr><th>Leg</th><th>Time (seconds)</th><th>Reason for Stopping</th></tr>
<tr><td><strong>LEFT Leg</strong></td><td>_____ sec (max 60)</td><td>________________</td></tr>
<tr><td><strong>RIGHT Leg</strong></td><td>_____ sec (max 60)</td><td>________________</td></tr>
</table>

<h4>Eyes Closed Results:</h4>
<table border="1" cellpadding="5">
<tr><th>Leg</th><th>Time (seconds)</th><th>Reason for Stopping</th></tr>
<tr><td><strong>LEFT Leg</strong></td><td>_____ sec (max 60)</td><td>________________</td></tr>
<tr><td><strong>RIGHT Leg</strong></td><td>_____ sec (max 60)</td><td>________________</td></tr>
</table>

<h4>Summary:</h4>
<p><strong>Best Eyes Open Time: _____ seconds</strong></p>
<p><strong>Best Eyes Closed Time: _____ seconds</strong></p>
<p><strong>Dominant Leg: â˜ Right â˜ Left</strong></p>
<p><strong>Required Support/Supervision: â˜ Yes â˜ No</strong></p>

<h4>Reason for Stopping (check all that apply):</h4>
<p>â˜ Completed 60 seconds &nbsp;&nbsp; â˜ Hands moved from position</p>
<p>â˜ Supporting foot shifted &nbsp;&nbsp; â˜ Lifted foot touched ground/leg</p>
<p>â˜ Loss of balance &nbsp;&nbsp; â˜ Client chose to stop</p>

<h4>Age-Based Norms (seconds) - Eyes Open:</h4>
<table border="1" cellpadding="5">
<tr><th>Age Group</th><th>Men</th><th>Women</th></tr>
<tr><td>20-49</td><td>43</td><td>41</td></tr>
<tr><td>50-59</td><td>40</td><td>37</td></tr>
<tr><td>60-69</td><td>32</td><td>30</td></tr>
<tr><td>70-79</td><td>22</td><td>19</td></tr>
<tr><td>80+</td><td>9</td><td>8</td></tr>
</table>

<h4>Interpretation:</h4>
<ul>
<li><strong>&lt; 5 seconds:</strong> High fall risk, significant balance impairment</li>
<li><strong>5-10 seconds:</strong> Moderate fall risk</li>
<li><strong>10-20 seconds:</strong> Mild balance issues</li>
<li><strong>&gt; 30 seconds:</strong> Good balance for age</li>
</ul>

<h4>Balance Strategies Observed:</h4>
<p>â˜ Hip strategy (hip movements to maintain balance)</p>
<p>â˜ Ankle strategy (ankle movements to maintain balance)</p>
<p>â˜ Step strategy (stepping to regain balance)</p>
<p>â˜ Upper extremity compensation</p>

<h4>Clinical Notes:</h4>
<p>_________________________________________________</p>
<p>_________________________________________________</p>`,

      'Blood Pressure (Pre/Post Exercise)': `
<h3>Blood Pressure Assessment (Pre/Post Exercise)</h3>
<p><strong>Equipment Required:</strong> Calibrated sphygmomanometer, appropriate cuff size, stethoscope</p>

<h4>Pre-Test Preparation:</h4>
<ul>
<li>Ensure participant has avoided caffeine, smoking, exercise for 30 minutes</li>
<li>Allow 5 minutes of quiet rest before measurement</li>
<li>Select appropriate cuff size (bladder width = 40% of arm circumference)</li>
<li>Ensure equipment is calibrated</li>
</ul>

<h4>Measurement Position:</h4>
<ul>
<li>Participant seated with back supported</li>
<li>Feet flat on floor, legs uncrossed</li>
<li>Arm supported at heart level</li>
<li>Palm facing up, arm relaxed</li>
<li>No talking during measurement</li>
</ul>

<h4>Measurement Technique:</h4>
<ol>
<li>Palpate brachial artery</li>
<li>Place cuff 2-3 cm above antecubital fossa</li>
<li>Inflate cuff to 20-30 mmHg above estimated systolic pressure</li>
<li>Deflate at 2-3 mmHg per second</li>
<li>Record systolic (first Korotkoff sound) and diastolic (fifth Korotkoff sound)</li>
<li>Wait 2 minutes between measurements</li>
</ol>

<h4>Pre-Exercise Blood Pressure:</h4>
<table border="1" cellpadding="5">
<tr><th>Measurement</th><th>Systolic (mmHg)</th><th>Diastolic (mmHg)</th><th>Time</th></tr>
<tr><td>Reading 1</td><td>_____</td><td>_____</td><td>_____</td></tr>
<tr><td>Reading 2</td><td>_____</td><td>_____</td><td>_____</td></tr>
<tr><td>Reading 3 (if needed)</td><td>_____</td><td>_____</td><td>_____</td></tr>
<tr><td><strong>Average</strong></td><td><strong>_____</strong></td><td><strong>_____</strong></td><td></td></tr>
</table>

<h4>Exercise Details:</h4>
<p><strong>Type of Exercise:</strong> ________________________</p>
<p><strong>Duration:</strong> ________________________</p>
<p><strong>Intensity:</strong> ________________________</p>
<p><strong>Time Exercise Completed:</strong> ________________________</p>

<h4>Post-Exercise Blood Pressure:</h4>
<table border="1" cellpadding="5">
<tr><th>Time Post-Exercise</th><th>Systolic (mmHg)</th><th>Diastolic (mmHg)</th><th>Notes</th></tr>
<tr><td>Immediately</td><td>_____</td><td>_____</td><td>________</td></tr>
<tr><td>2 minutes</td><td>_____</td><td>_____</td><td>________</td></tr>
<tr><td>5 minutes</td><td>_____</td><td>_____</td><td>________</td></tr>
<tr><td>10 minutes</td><td>_____</td><td>_____</td><td>________</td></tr>
</table>

<h4>Blood Pressure Classifications:</h4>
<table border="1" cellpadding="5">
<tr><th>Category</th><th>Systolic (mmHg)</th><th>Diastolic (mmHg)</th></tr>
<tr><td>Normal</td><td>&lt; 120</td><td>&lt; 80</td></tr>
<tr><td>Elevated</td><td>120-129</td><td>&lt; 80</td></tr>
<tr><td>Stage 1 Hypertension</td><td>130-139</td><td>80-89</td></tr>
<tr><td>Stage 2 Hypertension</td><td>≥ 140</td><td>≥ 90</td></tr>
<tr><td>Hypertensive Crisis</td><td>&gt; 180</td><td>&gt; 120</td></tr>
</table>

<h4>Exercise Response Analysis:</h4>
<p><strong>Pre-Exercise Classification:</strong> ________________________</p>
<p><strong>Peak Post-Exercise BP:</strong> ______ / ______ mmHg</p>
<p><strong>Recovery Pattern:</strong> â˜ Normal â˜ Delayed â˜ Hypertensive</p>
<p><strong>Time to Return to Baseline:</strong> __________ minutes</p>

<h4>Clinical Interpretation:</h4>
<p><strong>Normal Response:</strong> Systolic increases 20-40 mmHg, diastolic remains stable or decreases slightly</p>
<p><strong>Abnormal Response:</strong> Excessive rise (&gt;60 mmHg systolic), significant diastolic increase (&gt;15 mmHg), delayed recovery</p>

<h4>Clinical Notes:</h4>
<p>_________________________________________________</p>
<p>_________________________________________________</p>`,

      'Heart Rate (Pre/Post Exercise)': `
<h3>Heart Rate Assessment (Pre/Post Exercise)</h3>
<p><strong>Equipment Required:</strong> Stopwatch, heart rate monitor (optional), stethoscope</p>

<h4>Measurement Methods:</h4>
<ul>
<li><strong>Manual Palpation:</strong> Radial or carotid pulse for 15 seconds × 4</li>
<li><strong>Auscultation:</strong> Stethoscope over apex of heart</li>
<li><strong>Heart Rate Monitor:</strong> Chest strap or wrist-based device</li>
</ul>

<h4>Pre-Exercise Measurements:</h4>
<p><strong>Participant should be seated quietly for 5 minutes before measurement</strong></p>

<table border="1" cellpadding="5">
<tr><th>Measurement</th><th>Heart Rate (bpm)</th><th>Method Used</th><th>Time</th></tr>
<tr><td>Resting HR 1</td><td>_____</td><td>_________</td><td>_____</td></tr>
<tr><td>Resting HR 2</td><td>_____</td><td>_________</td><td>_____</td></tr>
<tr><td>Resting HR 3</td><td>_____</td><td>_________</td><td>_____</td></tr>
<tr><td><strong>Average Resting HR</strong></td><td><strong>_____</strong></td><td></td><td></td></tr>
</table>

<h4>Age-Predicted Maximum Heart Rate:</h4>
<p><strong>Age:</strong> _____ years</p>
<p><strong>Predicted Max HR (220 - age):</strong> _____ bpm</p>
<p><strong>Target Heart Rate Zones:</strong></p>
<ul>
<li><strong>50-60% (Very Light):</strong> _____ - _____ bpm</li>
<li><strong>60-70% (Light):</strong> _____ - _____ bpm</li>
<li><strong>70-80% (Moderate):</strong> _____ - _____ bpm</li>
<li><strong>80-90% (Hard):</strong> _____ - _____ bpm</li>
<li><strong>90-100% (Maximum):</strong> _____ - _____ bpm</li>
</ul>

<h4>Exercise Details:</h4>
<p><strong>Type of Exercise:</strong> ________________________</p>
<p><strong>Duration:</strong> ________________________</p>
<p><strong>Prescribed Intensity:</strong> ________________________</p>
<p><strong>Time Exercise Started:</strong> ________________________</p>
<p><strong>Time Exercise Completed:</strong> ________________________</p>

<h4>During Exercise Heart Rate:</h4>
<table border="1" cellpadding="5">
<tr><th>Time Point</th><th>Heart Rate (bpm)</th><th>% Max HR</th><th>RPE (6-20)</th></tr>
<tr><td>2 minutes</td><td>_____</td><td>_____%</td><td>_____</td></tr>
<tr><td>5 minutes</td><td>_____</td><td>_____%</td><td>_____</td></tr>
<tr><td>10 minutes</td><td>_____</td><td>_____%</td><td>_____</td></tr>
<tr><td>15 minutes</td><td>_____</td><td>_____%</td><td>_____</td></tr>
<tr><td>Peak/End</td><td>_____</td><td>_____%</td><td>_____</td></tr>
</table>

<h4>Post-Exercise Recovery:</h4>
<table border="1" cellpadding="5">
<tr><th>Time Post-Exercise</th><th>Heart Rate (bpm)</th><th>% of Peak HR</th><th>Notes</th></tr>
<tr><td>Immediately</td><td>_____</td><td>_____%</td><td>________</td></tr>
<tr><td>1 minute</td><td>_____</td><td>_____%</td><td>________</td></tr>
<tr><td>2 minutes</td><td>_____</td><td>_____%</td><td>________</td></tr>
<tr><td>3 minutes</td><td>_____%</td><td>_____%</td><td>________</td></tr>
<tr><td>5 minutes</td><td>_____%</td><td>_____%</td><td>________</td></tr>
<tr><td>10 minutes</td><td>_____%</td><td>_____%</td><td>________</td></tr>
</table>

<h4>Heart Rate Recovery Analysis:</h4>
<p><strong>1-Minute Heart Rate Recovery:</strong> _____ bpm</p>
<p>(Peak HR - HR at 1 minute post-exercise)</p>
<p><strong>Interpretation:</strong></p>
<ul>
<li><strong>&gt; 25 bpm:</strong> Excellent recovery</li>
<li><strong>18-25 bpm:</strong> Good recovery</li>
<li><strong>12-17 bpm:</strong> Fair recovery</li>
<li><strong>&lt; 12 bpm:</strong> Poor recovery</li>
</ul>

<h4>Resting Heart Rate Norms:</h4>
<table border="1" cellpadding="5">
<tr><th>Fitness Level</th><th>Men (bpm)</th><th>Women (bpm)</th></tr>
<tr><td>Athlete</td><td>40-60</td><td>40-60</td></tr>
<tr><td>Excellent</td><td>60-69</td><td>60-69</td></tr>
<tr><td>Good</td><td>70-79</td><td>70-79</td></tr>
<tr><td>Fair</td><td>80-89</td><td>80-89</td></tr>
<tr><td>Poor</td><td>&gt; 90</td><td>&gt; 90</td></tr>
</table>

<h4>Clinical Notes:</h4>
<p><strong>Exercise Tolerance:</strong> ________________________</p>
<p><strong>Abnormal Responses:</strong> ________________________</p>
<p><strong>Symptoms During Exercise:</strong> ________________________</p>
<p><strong>Recommendations:</strong> ________________________</p>`,

      'Oxygen Saturation (SpO2) Pre/Post Exercise': `
<h3>Oxygen Saturation (SpO2) Pre/Post Exercise Assessment</h3>
<p><strong>Equipment Required:</strong> Calibrated pulse oximeter, alcohol wipes</p>

<h4>Pre-Test Preparation:</h4>
<ul>
<li>Clean sensor with alcohol wipe</li>
<li>Remove nail polish from test finger if present</li>
<li>Ensure good circulation in hands (warm if cold)</li>
<li>Allow participant to rest quietly for 5 minutes</li>
<li>Check that oximeter is calibrated and functioning</li>
</ul>

<h4>Measurement Technique:</h4>
<ol>
<li>Place sensor on index or middle finger</li>
<li>Ensure finger is relaxed and still</li>
<li>Wait for stable reading (usually 10-30 seconds)</li>
<li>Record both SpO2 and pulse rate</li>
<li>Take multiple readings if initial values seem abnormal</li>
</ol>

<h4>Pre-Exercise Measurements:</h4>
<table border="1" cellpadding="5">
<tr><th>Measurement</th><th>SpO2 (%)</th><th>Pulse Rate (bpm)</th><th>Time</th></tr>
<tr><td>Reading 1</td><td>_____</td><td>_____</td><td>_____</td></tr>
<tr><td>Reading 2</td><td>_____</td><td>_____</td><td>_____</td></tr>
<tr><td>Reading 3</td><td>_____</td><td>_____</td><td>_____</td></tr>
<tr><td><strong>Average</strong></td><td><strong>_____</strong></td><td><strong>_____</strong></td><td></td></tr>
</table>

<h4>Normal SpO2 Values:</h4>
<ul>
<li><strong>Normal (sea level):</strong> 95-100%</li>
<li><strong>Acceptable:</strong> 90-95%</li>
<li><strong>Mild hypoxemia:</strong> 85-89%</li>
<li><strong>Moderate hypoxemia:</strong> 75-84%</li>
<li><strong>Severe hypoxemia:</strong> &lt; 75%</li>
</ul>

<h4>Exercise Details:</h4>
<p><strong>Type of Exercise:</strong> ________________________</p>
<p><strong>Duration:</strong> ________________________</p>
<p><strong>Intensity:</strong> ________________________</p>
<p><strong>Environmental Conditions:</strong> ________________________</p>
<p><strong>Time Exercise Started:</strong> ________________________</p>
<p><strong>Time Exercise Completed:</strong> ________________________</p>

<h4>During Exercise Monitoring:</h4>
<table border="1" cellpadding="5">
<tr><th>Time Point</th><th>SpO2 (%)</th><th>Heart Rate (bpm)</th><th>Symptoms</th></tr>
<tr><td>2 minutes</td><td>_____</td><td>_____</td><td>____________</td></tr>
<tr><td>5 minutes</td><td>_____</td><td>_____</td><td>____________</td></tr>
<tr><td>10 minutes</td><td>_____</td><td>_____</td><td>____________</td></tr>
<tr><td>Peak/End</td><td>_____</td><td>_____</td><td>____________</td></tr>
</table>

<h4>Post-Exercise Recovery:</h4>
<table border="1" cellpadding="5">
<tr><th>Time Post-Exercise</th><th>SpO2 (%)</th><th>Heart Rate (bpm)</th><th>Notes</th></tr>
<tr><td>Immediately</td><td>_____</td><td>_____</td><td>____________</td></tr>
<tr><td>2 minutes</td><td>_____</td><td>_____</td><td>____________</td></tr>
<tr><td>5 minutes</td><td>_____</td><td>_____</td><td>____________</td></tr>
<tr><td>10 minutes</td><td>_____</td><td>_____</td><td>____________</td></tr>
<tr><td>15 minutes</td><td>_____</td><td>_____</td><td>____________</td></tr>
</table>

<h4>Exercise Response Analysis:</h4>
<p><strong>Lowest SpO2 During Exercise:</strong> _____%</p>
<p><strong>SpO2 Drop from Baseline:</strong> _____%</p>
<p><strong>Time to Return to Baseline:</strong> _____ minutes</p>

<h4>Clinical Significance:</h4>
<ul>
<li><strong>Normal Response:</strong> SpO2 remains &gt; 90% during exercise</li>
<li><strong>Exercise-Induced Hypoxemia:</strong> SpO2 drops &gt; 4% or falls below 90%</li>
<li><strong>Severe Response:</strong> SpO2 &lt; 85% during exercise</li>
</ul>

<h4>Symptoms Assessment:</h4>
<p>Check any symptoms experienced during exercise:</p>
<p>â˜ Shortness of breath â˜ Chest tightness â˜ Dizziness</p>
<p>â˜ Fatigue â˜ Leg cramping â˜ Nausea</p>
<p>â˜ Headache â˜ Confusion â˜ None</p>

<p><strong>Other symptoms:</strong> ________________________</p>

<h4>Factors Affecting SpO2:</h4>
<ul>
<li>Altitude/elevation: ________________________</li>
<li>Respiratory conditions: ________________________</li>
<li>Cardiovascular status: ________________________</li>
<li>Smoking history: ________________________</li>
<li>Medications: ________________________</li>
</ul>

<h4>Clinical Recommendations:</h4>
<p><strong>Exercise Tolerance:</strong> ________________________</p>
<p><strong>Oxygen Supplementation Needed:</strong> â˜ Yes â˜ No</p>
<p><strong>Follow-up Required:</strong> â˜ Yes â˜ No</p>
<p><strong>Referral Indicated:</strong> ________________________</p>

<h4>Clinical Notes:</h4>
<p>_________________________________________________</p>
<p>_________________________________________________</p>`,

      'Hip Outcome Score (HOOS)': `
<h3>Hip Outcome Score (HOOS)</h3>
<p><strong>Instructions:</strong> This survey asks for your view about your hip. This information will help us keep track of how you feel about your hip and how well you are able to perform your usual activities. Answer every question by checking the appropriate box, only one box for each question. If you are unsure about how to answer a question, please give the best answer you can.</p>

<h4>SYMPTOMS</h4>
<p>These questions concern symptoms you may have experienced during the last week.</p>

<table border="1" cellpadding="5">
<tr><th>Question</th><th>None (0)</th><th>Mild (1)</th><th>Moderate (2)</th><th>Severe (3)</th><th>Extreme (4)</th></tr>
<tr><td>S1. Do you feel grinding, hear clicking or any other type of noise when your hip moves?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>S2. Difficulties stretching your hip fully?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>S3. Difficulties striding out when walking?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>S4. Morning stiffness after first wakening?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>S5. Hip stiffness later in the day?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>PAIN</h4>
<p>P1. How often do you experience hip pain?</p>
<table border="1" cellpadding="5">
<tr><td>Never (0) â˜</td><td>Monthly (1) â˜</td><td>Weekly (2) â˜</td><td>Daily (3) â˜</td><td>Always (4) â˜</td></tr>
</table>

<p>What amount of hip pain have you experienced the last week during the following activities?</p>
<table border="1" cellpadding="5">
<tr><th>Activity</th><th>None (0)</th><th>Mild (1)</th><th>Moderate (2)</th><th>Severe (3)</th><th>Extreme (4)</th></tr>
<tr><td>P2. Twisting/pivoting on your hip</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P3. Straightening hip fully</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P4. Bending hip fully</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P5. Walking on flat surface</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P6. Going up or down stairs</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P7. At night while in bed</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P8. Sitting or lying</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P9. Standing upright</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P10. Walking on hard surface</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>FUNCTION, ACTIVITIES OF DAILY LIVING</h4>
<p>The following questions concern your physical function. What degree of difficulty have you experienced in the last week due to your hip?</p>

<table border="1" cellpadding="5">
<tr><th>Activity</th><th>None (0)</th><th>Mild (1)</th><th>Moderate (2)</th><th>Severe (3)</th><th>Extreme (4)</th></tr>
<tr><td>A1. Descending stairs</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A2. Ascending stairs</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A3. Rising from sitting</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A4. Standing</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A5. Bending to floor/pick up object</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A6. Walking on flat surface</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A7. Getting in/out of car</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A8. Going shopping</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A9. Putting on socks/stockings</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A10. Rising from bed</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A11. Taking off socks/stockings</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A12. Lying in bed</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A13. Getting in/out of bath</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A14. Sitting</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A15. Getting on/off toilet</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A16. Heavy domestic duties</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A17. Light domestic duties</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>FUNCTION, SPORT AND RECREATION</h4>
<p>The following questions concern your physical function when being active on a higher level. What degree of difficulty have you experienced during the last week due to your hip?</p>

<table border="1" cellpadding="5">
<tr><th>Activity</th><th>None (0)</th><th>Mild (1)</th><th>Moderate (2)</th><th>Severe (3)</th><th>Extreme (4)</th></tr>
<tr><td>SP1. Squatting</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>SP2. Running</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>SP3. Jumping</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>SP4. Turning/twisting on loaded leg</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>FUNCTION, HIP-RELATED QUALITY OF LIFE</h4>
<table border="1" cellpadding="5">
<tr><th>Question</th><th>Not at all (0)</th><th>Mildly (1)</th><th>Moderately (2)</th><th>Severely (3)</th><th>Extremely (4)</th></tr>
<tr><td>Q1. How often are you aware of your hip?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>Q2. Have you modified your lifestyle to avoid activities potentially damaging to your hip?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>Q3. How much trouble have you had with lack of confidence in your hip?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>Q4. In general, how much difficulty do you have with your hip?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>Scoring Instructions:</h4>
<p><strong>Each subscale is scored separately:</strong></p>
<ul>
<li><strong>Symptoms:</strong> Sum of items S1-S5, normalize to 0-100</li>
<li><strong>Pain:</strong> Sum of items P1-P10, normalize to 0-100</li>
<li><strong>ADL:</strong> Sum of items A1-A17, normalize to 0-100</li>
<li><strong>Sport/Recreation:</strong> Sum of items SP1-SP4, normalize to 0-100</li>
<li><strong>Quality of Life:</strong> Sum of items Q1-Q4, normalize to 0-100</li>
</ul>
<p><strong>Scoring Formula:</strong> ((Raw Score / Maximum Possible Score) × 100) then subtract from 100<br>
<strong>Higher scores = Better function</strong></p>`,

      'Knee Injury and Osteoarthritis Outcome Score (KOOS)': `
<h3>Knee Injury and Osteoarthritis Outcome Score (KOOS)</h3>
<p><strong>Instructions:</strong> This survey asks for your view about your knee. This information will help us keep track of how you feel about your knee and how well you are able to perform your usual activities. Answer every question by checking the appropriate box, only one box for each question. If you are unsure about how to answer a question, please give the best answer you can.</p>

<h4>SYMPTOMS</h4>
<p>These questions concern symptoms you may have experienced during the last week.</p>

<table border="1" cellpadding="5">
<tr><th>Question</th><th>Never (0)</th><th>Rarely (1)</th><th>Sometimes (2)</th><th>Often (3)</th><th>Always (4)</th></tr>
<tr><td>S1. Do you feel grinding, hear clicking or any other type of noise when your knee moves?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>S2. Do you feel catching or hanging up of your knee when moving?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>S3. Can you straighten your knee fully?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>S4. Can you bend your knee fully?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<table border="1" cellpadding="5">
<tr><th>Question</th><th>None (0)</th><th>Mild (1)</th><th>Moderate (2)</th><th>Severe (3)</th><th>Extreme (4)</th></tr>
<tr><td>S5. How severe is your knee joint stiffness after first wakening in the morning?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>S6. How severe is your knee stiffness after sitting, lying or resting later in the day?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>S7. Degree of swelling in your knee?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>PAIN</h4>
<p>P1. How often do you experience knee pain?</p>
<table border="1" cellpadding="5">
<tr><td>Never (0) â˜</td><td>Monthly (1) â˜</td><td>Weekly (2) â˜</td><td>Daily (3) â˜</td><td>Always (4) â˜</td></tr>
</table>

<p>What amount of knee pain have you experienced the last week during the following activities?</p>
<table border="1" cellpadding="5">
<tr><th>Activity</th><th>None (0)</th><th>Mild (1)</th><th>Moderate (2)</th><th>Severe (3)</th><th>Extreme (4)</th></tr>
<tr><td>P2. Twisting/pivoting on your knee</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P3. Straightening knee fully</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P4. Bending knee fully</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P5. Walking on flat surface</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P6. Going up or down stairs</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P7. At night while in bed</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P8. Sitting or lying</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>P9. Standing upright</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>FUNCTION, ACTIVITIES OF DAILY LIVING</h4>
<p>The following questions concern your physical function. What degree of difficulty have you experienced in the last week due to your knee?</p>

<table border="1" cellpadding="5">
<tr><th>Activity</th><th>None (0)</th><th>Mild (1)</th><th>Moderate (2)</th><th>Severe (3)</th><th>Extreme (4)</th></tr>
<tr><td>A1. Descending stairs</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A2. Ascending stairs</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A3. Rising from sitting</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A4. Standing</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A5. Bending to floor/pick up object</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A6. Walking on flat surface</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A7. Getting in/out of car</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A8. Going shopping</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A9. Putting on socks/stockings</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A10. Rising from bed</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A11. Taking off socks/stockings</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A12. Lying in bed</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A13. Getting in/out of bath</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A14. Sitting</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A15. Getting on/off toilet</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A16. Heavy domestic duties</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>A17. Light domestic duties</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>FUNCTION, SPORT AND RECREATION</h4>
<p>The following questions concern your physical function when being active on a higher level. What degree of difficulty have you experienced during the last week due to your knee?</p>

<table border="1" cellpadding="5">
<tr><th>Activity</th><th>None (0)</th><th>Mild (1)</th><th>Moderate (2)</th><th>Severe (3)</th><th>Extreme (4)</th></tr>
<tr><td>SP1. Squatting</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>SP2. Running</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>SP3. Jumping</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>SP4. Turning/twisting on injured knee</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>SP5. Kneeling</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>FUNCTION, KNEE-RELATED QUALITY OF LIFE</h4>
<table border="1" cellpadding="5">
<tr><th>Question</th><th>Not at all (0)</th><th>Mildly (1)</th><th>Moderately (2)</th><th>Severely (3)</th><th>Extremely (4)</th></tr>
<tr><td>Q1. How often are you aware of your knee?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>Q2. Have you modified your lifestyle to avoid activities potentially damaging to your knee?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>Q3. How much trouble have you had with lack of confidence in your knee?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
<tr><td>Q4. In general, how much difficulty do you have with your knee?</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td><td>â˜</td></tr>
</table>

<h4>Scoring Instructions:</h4>
<p><strong>Each subscale is scored separately:</strong></p>
<ul>
<li><strong>Symptoms:</strong> Sum of items S1-S7, normalize to 0-100</li>
<li><strong>Pain:</strong> Sum of items P1-P9, normalize to 0-100</li>
<li><strong>ADL:</strong> Sum of items A1-A17, normalize to 0-100</li>
<li><strong>Sport/Recreation:</strong> Sum of items SP1-SP5, normalize to 0-100</li>
<li><strong>Quality of Life:</strong> Sum of items Q1-Q4, normalize to 0-100</li>
</ul>
<p><strong>Scoring Formula:</strong> ((Raw Score / Maximum Possible Score) × 100) then subtract from 100<br>
<strong>Higher scores = Better function</strong></p>`,

      'Range of Motion (ROM) Assessment': `
<h3>Range of Motion (ROM) Assessment - Goniometry</h3>
<p><strong>Equipment Required:</strong> Goniometer (standard or digital), pen, assessment form</p>

<h4>General Instructions:</h4>
<ul>
<li>Ensure patient is positioned correctly and comfortably</li>
<li>Expose the joint being measured</li>
<li>Perform passive ROM first, then active ROM if required</li>
<li>Document any pain, crepitus, or end-feel abnormalities</li>
<li>Compare bilateral measurements when applicable</li>
</ul>

<h4>Patient Information:</h4>
<table border="1" cellpadding="5">
<tr><td><strong>Client Name:</strong> _________________________</td><td><strong>Date:</strong> _____________</td></tr>
<tr><td><strong>Assessor:</strong> _________________________</td><td><strong>Joint(s) Assessed:</strong> _____________</td></tr>
</table>

<h4>CERVICAL SPINE</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>45-50°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>45-75°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Lateral Flexion</td><td>45°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Rotation</td><td>60-80°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>THORACIC/LUMBAR SPINE</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Measurement</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>80-90°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>20-30°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Lateral Flexion L</td><td>35°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Lateral Flexion R</td><td>35°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Rotation L</td><td>45°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Rotation R</td><td>45°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>SHOULDER</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>150-180°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>40-60°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Abduction</td><td>150-180°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Adduction</td><td>30-50°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Internal Rotation</td><td>60-90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>External Rotation</td><td>80-90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Horizontal Abduction</td><td>30-45°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Horizontal Adduction</td><td>120-135°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>ELBOW</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>140-150°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>0° (or 0-10° hyperext)</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>FOREARM</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Pronation</td><td>80-90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Supination</td><td>80-90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>WRIST</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>60-80°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>60-70°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Radial Deviation</td><td>20°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Ulnar Deviation</td><td>30-35°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>HIP</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion (knee extended)</td><td>90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Flexion (knee flexed)</td><td>120-135°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>10-30°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Abduction</td><td>40-45°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Adduction</td><td>20-30°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Internal Rotation</td><td>30-45°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>External Rotation</td><td>45-60°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>KNEE</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>130-150°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>0° (or 0-10° hyperext)</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>ANKLE</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Dorsiflexion</td><td>20°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Plantarflexion</td><td>40-50°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Inversion</td><td>30-35°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Eversion</td><td>15-20°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>END-FEEL DOCUMENTATION</h4>
<table border="1" cellpadding="5">
<tr><th>Joint/Movement</th><th>End-Feel Type</th><th>Normal/Abnormal</th><th>Notes</th></tr>
<tr><td>________________</td><td>â˜ Soft â˜ Firm â˜ Hard â˜ Empty</td><td>_____</td><td>________________</td></tr>
<tr><td>________________</td><td>â˜ Soft â˜ Firm â˜ Hard â˜ Empty</td><td>_____</td><td>________________</td></tr>
<tr><td>________________</td><td>â˜ Soft â˜ Firm â˜ Hard â˜ Empty</td><td>_____</td><td>________________</td></tr>
</table>

<h4>End-Feel Reference:</h4>
<ul>
<li><strong>Soft:</strong> Soft tissue approximation (e.g., knee flexion, elbow flexion)</li>
<li><strong>Firm:</strong> Capsular/ligamentous stretch (e.g., hip rotation, ankle dorsiflexion)</li>
<li><strong>Hard:</strong> Bone-to-bone contact (e.g., elbow extension)</li>
<li><strong>Empty:</strong> No mechanical resistance - stopped by pain (pathological)</li>
</ul>

<h4>CLINICAL OBSERVATIONS:</h4>
<p><strong>Compensatory movements noted:</strong></p>
<p>_________________________________________________</p>
<p><strong>Quality of movement:</strong></p>
<p>_________________________________________________</p>
<p><strong>Crepitus present:</strong> â˜ Yes â˜ No &nbsp;&nbsp; Location: _____________</p>

<h4>SUMMARY & RECOMMENDATIONS:</h4>
<p><strong>Joints with limited ROM:</strong></p>
<p>_________________________________________________</p>
<p><strong>Treatment recommendations:</strong></p>
<p>_________________________________________________</p>
<p><strong>Re-assessment interval:</strong> _____________</p>

<p><strong>Examiner Signature:</strong> _______________________ <strong>Date:</strong> _________</p>`,

      'Range of Motion (Goniometry)': `
<h3>Range of Motion (ROM) Assessment - Goniometry</h3>
<p><strong>Equipment Required:</strong> Goniometer (standard or digital), pen, assessment form</p>

<h4>General Instructions:</h4>
<ul>
<li>Ensure patient is positioned correctly and comfortably</li>
<li>Expose the joint being measured</li>
<li>Perform passive ROM first, then active ROM if required</li>
<li>Document any pain, crepitus, or end-feel abnormalities</li>
<li>Compare bilateral measurements when applicable</li>
</ul>

<h4>Patient Information:</h4>
<table border="1" cellpadding="5">
<tr><td><strong>Client Name:</strong> _________________________</td><td><strong>Date:</strong> _____________</td></tr>
<tr><td><strong>Assessor:</strong> _________________________</td><td><strong>Joint(s) Assessed:</strong> _____________</td></tr>
</table>

<h4>CERVICAL SPINE</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>45-50°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>45-75°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Lateral Flexion</td><td>45°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Rotation</td><td>60-80°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>THORACIC/LUMBAR SPINE</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Measurement</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>80-90°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>20-30°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Lateral Flexion L</td><td>35°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Lateral Flexion R</td><td>35°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Rotation L</td><td>45°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Rotation R</td><td>45°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>SHOULDER</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>150-180°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>40-60°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Abduction</td><td>150-180°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Adduction</td><td>30-50°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Internal Rotation</td><td>60-90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>External Rotation</td><td>80-90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Horizontal Abduction</td><td>30-45°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Horizontal Adduction</td><td>120-135°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>ELBOW</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>140-150°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>0° (or 0-10° hyperext)</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>FOREARM</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Pronation</td><td>80-90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Supination</td><td>80-90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>WRIST</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>60-80°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>60-70°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Radial Deviation</td><td>20°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Ulnar Deviation</td><td>30-35°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>HIP</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion (knee extended)</td><td>90°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Flexion (knee flexed)</td><td>120-135°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>10-30°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Abduction</td><td>40-45°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Adduction</td><td>20-30°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Internal Rotation</td><td>30-45°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>External Rotation</td><td>45-60°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>KNEE</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Flexion</td><td>130-150°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Extension</td><td>0° (or 0-10° hyperext)</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>ANKLE</h4>
<table border="1" cellpadding="5">
<tr><th>Movement</th><th>Normal ROM</th><th>Left</th><th>Right</th><th>Pain (Y/N)</th><th>Comments</th></tr>
<tr><td>Dorsiflexion</td><td>20°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Plantarflexion</td><td>40-50°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Inversion</td><td>30-35°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
<tr><td>Eversion</td><td>15-20°</td><td>_____°</td><td>_____°</td><td>_____</td><td>________________</td></tr>
</table>

<h4>END-FEEL DOCUMENTATION</h4>
<table border="1" cellpadding="5">
<tr><th>Joint/Movement</th><th>End-Feel Type</th><th>Normal/Abnormal</th><th>Notes</th></tr>
<tr><td>________________</td><td>â˜ Soft â˜ Firm â˜ Hard â˜ Empty</td><td>_____</td><td>________________</td></tr>
<tr><td>________________</td><td>â˜ Soft â˜ Firm â˜ Hard â˜ Empty</td><td>_____</td><td>________________</td></tr>
<tr><td>________________</td><td>â˜ Soft â˜ Firm â˜ Hard â˜ Empty</td><td>_____</td><td>________________</td></tr>
</table>

<h4>End-Feel Reference:</h4>
<ul>
<li><strong>Soft:</strong> Soft tissue approximation (e.g., knee flexion, elbow flexion)</li>
<li><strong>Firm:</strong> Capsular/ligamentous stretch (e.g., hip rotation, ankle dorsiflexion)</li>
<li><strong>Hard:</strong> Bone-to-bone contact (e.g., elbow extension)</li>
<li><strong>Empty:</strong> No mechanical resistance - stopped by pain (pathological)</li>
</ul>

<h4>CLINICAL OBSERVATIONS:</h4>
<p><strong>Compensatory movements noted:</strong></p>
<p>_________________________________________________</p>
<p><strong>Quality of movement:</strong></p>
<p>_________________________________________________</p>
<p><strong>Crepitus present:</strong> â˜ Yes â˜ No &nbsp;&nbsp; Location: _____________</p>

<h4>SUMMARY & RECOMMENDATIONS:</h4>
<p><strong>Joints with limited ROM:</strong></p>
<p>_________________________________________________</p>
<p><strong>Treatment recommendations:</strong></p>
<p>_________________________________________________</p>
<p><strong>Re-assessment interval:</strong> _____________</p>

<p><strong>Examiner Signature:</strong> _______________________ <strong>Date:</strong> _________</p>`,

      'Job Task Analysis (iCare) for WorkCover': `
<h3>Job Task Analysis (iCare) for WorkCover</h3>
<p><strong>Purpose:</strong> To assess functional capacity in relation to specific job demands and determine return to work capacity for WorkCover QLD clients.</p>

<h4>PART A: CLIENT INFORMATION</h4>
<table border="1" cellpadding="5">
<tr><td><strong>Client Name:</strong> _________________________</td><td><strong>Date:</strong> _____________</td></tr>
<tr><td><strong>Claim Number:</strong> _________________________</td><td><strong>Assessor:</strong> _____________</td></tr>
<tr><td><strong>Job Title:</strong> _________________________</td><td><strong>Employer:</strong> _____________</td></tr>
<tr><td><strong>Date of Injury:</strong> _________________________</td><td><strong>Assessment Duration:</strong> _____________</td></tr>
</table>

<h4>PART B: JOB DESCRIPTION ANALYSIS</h4>
<p><strong>Primary Job Tasks:</strong></p>
<ol>
<li>_________________________________________________</li>
<li>_________________________________________________</li>
<li>_________________________________________________</li>
<li>_________________________________________________</li>
<li>_________________________________________________</li>
</ol>

<h4>PART C: PHYSICAL DEMANDS ASSESSMENT</h4>
<table border="1" cellpadding="5">
<tr><th>Physical Demand</th><th>Job Requirement</th><th>Client Capacity</th><th>Match (Y/N)</th><th>Comments</th></tr>
<tr><td><strong>Lifting (floor to waist)</strong></td><td>_____ kg, _____ freq</td><td>_____ kg, _____ freq</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Lifting (waist to shoulder)</strong></td><td>_____ kg, _____ freq</td><td>_____ kg, _____ freq</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Carrying</strong></td><td>_____ kg, _____ m</td><td>_____ kg, _____ m</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Pushing</strong></td><td>_____ kg</td><td>_____ kg</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Pulling</strong></td><td>_____ kg</td><td>_____ kg</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Walking</strong></td><td>_____ hrs/day</td><td>_____ hrs/day</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Standing</strong></td><td>_____ hrs/day</td><td>_____ hrs/day</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Sitting</strong></td><td>_____ hrs/day</td><td>_____ hrs/day</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Climbing</strong></td><td>_____ freq</td><td>_____ freq</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Crawling/Kneeling</strong></td><td>_____ freq</td><td>_____ freq</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Bending/Stooping</strong></td><td>_____ freq</td><td>_____ freq</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Reaching Above Shoulder</strong></td><td>_____ freq</td><td>_____ freq</td><td>_____</td><td>________________</td></tr>
<tr><td><strong>Repetitive Hand/Wrist</strong></td><td>_____ freq</td><td>_____ freq</td><td>_____</td><td>________________</td></tr>
</table>

<h4>PART D: ENVIRONMENTAL FACTORS</h4>
<table border="1" cellpadding="5">
<tr><th>Environmental Factor</th><th>Present in Job (Y/N)</th><th>Client Tolerance</th><th>Impact</th></tr>
<tr><td>Temperature extremes</td><td>_____</td><td>_____________</td><td>_________________</td></tr>
<tr><td>Noise levels</td><td>_____</td><td>_____________</td><td>_________________</td></tr>
<tr><td>Vibration</td><td>_____</td><td>_____________</td><td>_________________</td></tr>
<tr><td>Chemical exposure</td><td>_____</td><td>_____________</td><td>_________________</td></tr>
<tr><td>Working at heights</td><td>_____</td><td>_____________</td><td>_________________</td></tr>
<tr><td>Confined spaces</td><td>_____</td><td>_____________</td><td>_________________</td></tr>
<tr><td>Shift work</td><td>_____</td><td>_____________</td><td>_________________</td></tr>
</table>

<h4>PART E: COGNITIVE DEMANDS</h4>
<table border="1" cellpadding="5">
<tr><th>Cognitive Demand</th><th>Required Level</th><th>Client Capacity</th><th>Match (Y/N)</th></tr>
<tr><td>Concentration/Attention</td><td>_____________</td><td>_____________</td><td>_____</td></tr>
<tr><td>Memory</td><td>_____________</td><td>_____________</td><td>_____</td></tr>
<tr><td>Problem solving</td><td>_____________</td><td>_____________</td><td>_____</td></tr>
<tr><td>Multi-tasking</td><td>_____________</td><td>_____________</td><td>_____</td></tr>
<tr><td>Safety awareness</td><td>_____________</td><td>_____________</td><td>_____</td></tr>
</table>

<h4>PART F: FUNCTIONAL TASK TESTING</h4>
<p>Document performance on job-specific tasks:</p>

<table border="1" cellpadding="5">
<tr><th>Task</th><th>Duration Tested</th><th>Performance</th><th>Observations</th><th>Rating</th></tr>
<tr><td>Task 1: _______________</td><td>_________</td><td>____________</td><td>__________________</td><td>_____</td></tr>
<tr><td>Task 2: _______________</td><td>_________</td><td>____________</td><td>__________________</td><td>_____</td></tr>
<tr><td>Task 3: _______________</td><td>_________</td><td>____________</td><td>__________________</td><td>_____</td></tr>
<tr><td>Task 4: _______________</td><td>_________</td><td>____________</td><td>__________________</td><td>_____</td></tr>
<tr><td>Task 5: _______________</td><td>_________</td><td>____________</td><td>__________________</td><td>_____</td></tr>
</table>

<p><strong>Performance Rating Scale:</strong></p>
<ul>
<li><strong>1 = Able to perform:</strong> No limitations, full capacity</li>
<li><strong>2 = Able with modifications:</strong> Can perform with workplace adjustments</li>
<li><strong>3 = Unable to perform:</strong> Cannot safely complete task</li>
</ul>

<h4>PART G: PAIN AND SYMPTOM MONITORING</h4>
<table border="1" cellpadding="5">
<tr><th>Time</th><th>Pain Level (0-10)</th><th>Location</th><th>Symptoms</th><th>Activity</th></tr>
<tr><td>Start:</td><td>_____</td><td>____________</td><td>_______________</td><td>_____________</td></tr>
<tr><td>30 min:</td><td>_____</td><td>____________</td><td>_______________</td><td>_____________</td></tr>
<tr><td>60 min:</td><td>_____</td><td>____________</td><td>_______________</td><td>_____________</td></tr>
<tr><td>End:</td><td>_____</td><td>____________</td><td>_______________</td><td>_____________</td></tr>
<tr><td>24hr follow-up:</td><td>_____</td><td>____________</td><td>_______________</td><td>_____________</td></tr>
</table>

<h4>PART H: BARRIERS TO RETURN TO WORK</h4>
<p><strong>Physical Barriers:</strong></p>
<p>________________________________________________</p>
<p>________________________________________________</p>

<p><strong>Psychological Barriers:</strong></p>
<p>________________________________________________</p>
<p>________________________________________________</p>

<p><strong>Workplace Barriers:</strong></p>
<p>________________________________________________</p>
<p>________________________________________________</p>

<h4>PART I: RECOMMENDATIONS</h4>
<table border="1" cellpadding="5">
<tr><th>Return to Work Capacity</th><th>â˜ Full duties</th><th>â˜ Modified duties</th><th>â˜ Not suitable</th></tr>
</table>

<p><strong>Specific Recommendations:</strong></p>
<ol>
<li>_________________________________________________</li>
<li>_________________________________________________</li>
<li>_________________________________________________</li>
<li>_________________________________________________</li>
<li>_________________________________________________</li>
</ol>

<p><strong>Workplace Modifications Required:</strong></p>
<p>________________________________________________</p>
<p>________________________________________________</p>

<p><strong>Graduated Return to Work Plan:</strong></p>
<table border="1" cellpadding="5">
<tr><th>Week</th><th>Hours/Day</th><th>Days/Week</th><th>Duties</th><th>Restrictions</th></tr>
<tr><td>1-2</td><td>_____</td><td>_____</td><td>_______________</td><td>_______________</td></tr>
<tr><td>3-4</td><td>_____</td><td>_____</td><td>_______________</td><td>_______________</td></tr>
<tr><td>5-6</td><td>_____</td><td>_____</td><td>_______________</td><td>_______________</td></tr>
<tr><td>7-8</td><td>_____</td><td>_____</td><td>_______________</td><td>_______________</td></tr>
</table>

<p><strong>Follow-up Required:</strong> â˜ Yes â˜ No</p>
<p><strong>If yes, when:</strong> _________________________</p>

<p><strong>Assessor Signature:</strong> _______________________ <strong>Date:</strong> _________</p>
<p><strong>Professional Registration:</strong> _________________________________</p>`
    };

    return assessmentQuestions[assessmentName] || assessment.instructions || 'No specific instructions provided.';
  };

  const getAssessmentReference = (assessmentName) => {
    const references = {
      'Berg Balance Scale': 'Berg, K. O., Wood-Dauphinee, S. L., Williams, J. I., & Maki, B. (1992). Measuring balance in the elderly: validation of an instrument. Canadian journal of public health, 83, S7-S11.',
      'Timed Up and Go (TUG)': 'Podsiadlo, D., & Richardson, S. (1991). The timed "Up & Go": a test of basic functional mobility for frail elderly persons. Journal of the American geriatrics Society, 39(2), 142-148.',
      'Hand Grip Strength': 'Mathiowetz, V., Weber, K., Volland, G., & Kashman, N. (1984). Reliability and validity of grip and pinch strength evaluations. Journal of hand surgery, 9(2), 222-226.',
      '6 Minute Walk Test': 'ATS Committee on Proficiency Standards for Clinical Pulmonary Function Laboratories. (2002). ATS statement: guidelines for the six-minute walk test. American journal of respiratory and critical care medicine, 166(1), 111-117.',
      'Kessler Psychological Distress Scale (K10)': 'Kessler, R. C., Andrews, G., Colpe, L. J., et al. (2002). Short screening scales to monitor population prevalences and trends in non-specific psychological distress. Psychological medicine, 32(6), 959-976.',
      'PHQ-9': 'Kroenke, K., Spitzer, R. L., & Williams, J. B. (2001). The PHQâ€9: validity of a brief depression severity measure. Journal of general internal medicine, 16(9), 606-613.',
      'GAD-7': 'Spitzer, R. L., Kroenke, K., Williams, J. B., & Löwe, B. (2006). A brief measure for assessing generalized anxiety disorder: the GAD-7. Archives of internal medicine, 166(10), 1092-1097.',
      '2-Minute Step Test': 'Rikli, R. E., & Jones, C. J. (2013). Senior fitness test manual. Human Kinetics.',
      '30-Second Sit to Stand Test': 'Jones, C. J., Rikli, R. E., & Beam, W. C. (1999). A 30-s chair-stand test as a measure of lower body strength in community-residing older adults. Research quarterly for exercise and sport, 70(2), 113-119.',
      'Four-Stage Balance Test': 'Rossiter-Fornoff, J. E., Wolf, S. L., Wolfson, L. I., & Buchner, D. M. (1995). A cross-sectional validation study of the FICSIT common data base static balance measures. The Journals of Gerontology Series A: Biological Sciences and Medical Sciences, 50(6), M291-M297.',
      'Single Leg Stance Test': 'Vellas, B. J., Wayne, S. J., Romero, L., Baumgartner, R. N., & Rubenstein, L. Z., & Garry, P. J. (1997). Oneâ€leg balance is an important predictor of injurious falls in older persons. Journal of the American Geriatrics Society, 45(6), 735-738.',
      'Blood Pressure (Pre/Post Exercise)': 'Whelton, P. K., Carey, R. M., Aronow, W. S., et al. (2018). 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA guideline for the prevention, detection, evaluation, and management of high blood pressure in adults. Hypertension, 71(6), e13-e115.',
      'Heart Rate (Pre/Post Exercise)': 'Tanaka, H., Monahan, K. D., & Seals, D. R. (2001). Age-predicted maximal heart rate revisited. Journal of the American College of Cardiology, 37(1), 153-156.',
      'Oxygen Saturation (SpO2) Pre/Post Exercise': 'Weisman, I. M., Marciniuk, D., Martinez, F. J., et al. (2003). ATS/ACCP statement on cardiopulmonary exercise testing. American journal of respiratory and critical care medicine, 167(2), 211-277.',
      'Hip Outcome Score (HOOS)': 'Nilsdotter, A. K., Lohmander, L. S., Klässbo, M., & Roos, E. M. (2003). Hip disability and osteoarthritis outcome score (HOOS) - validity and responsiveness in total hip replacement. BMC Musculoskeletal Disorders, 4, 10.',
      'Knee Injury and Osteoarthritis Outcome Score (KOOS)': 'Roos, E. M., Roos, H. P., Lohmander, L. S., Ekdahl, C., & Beynnon, B. D. (1998). Knee Injury and Osteoarthritis Outcome Score (KOOS) - development of a self-administered outcome measure. Journal of Orthopaedic & Sports Physical Therapy, 28(2), 88-96.',
      'Job Task Analysis (iCare) for WorkCover': 'iCare NSW. (2020). Functional Capacity Evaluation Guidelines for Return to Work Assessments. WorkCover Queensland Guidelines for Workplace Rehabilitation and Return to Work Programs.'
    };

    return references[assessmentName] || null;
  };

  const handleDownloadForm = () => {
    // Create a printable form including the assessment questions
    const printContent = `
      <html>
        <head>
          <title>${assessment.name} - Assessment Form</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 2rem; color: #333; line-height: 1.4; }
            h1, h2, h3 { color: #111; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 2rem; }
            .section { margin-bottom: 2rem; page-break-inside: avoid; }
            .field { margin-bottom: 1rem; }
            .field label { font-weight: 600; display: block; margin-bottom: 0.5rem; }
            .notes-box { border: 1px solid #cbd5e1; min-height: 100px; margin-top: 0.5rem; border-radius: 0.375rem; padding: 0.5rem; }
            .instructions-content { white-space: pre-wrap; line-height: 1.6; background-color: #f8fafc; padding: 1rem; border-radius: 0.375rem; border: 1px solid #e2e8f0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            th, td { border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left; }
            th { background-color: #f8fafc; }
            ol { counter-reset: item; padding-left: 1.5em; }
            li { display: block; margin-bottom: 1em; }
            li:before { content: counters(item, ".") ". "; counter-increment: item; font-weight: bold; }
            @media print {
              body { margin: 1cm; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${assessment.name}</h1>
            <p><strong>Category:</strong> ${formatCategory(assessment.category)}</p>
            <p><strong>Client Name:</strong> _________________________</p>
            <p><strong>Date:</strong> _________________________</p>
            <p><strong>Examiner:</strong> _________________________</p>
          </div>
          
          <div class="section">
            <h2>Assessment Instructions & Items</h2>
            <div class="instructions-content">${getAssessmentQuestions(assessment.name)}</div>
          </div>
          
          ${assessment.questions && assessment.questions.length > 0 ? `
          <div class="section">
            <h2>Assessment Questions</h2>
            ${assessment.questions.map((question, index) => `
              <div style="margin-bottom: 1.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 1rem;">
                <p style="font-weight: 600; margin-bottom: 0.5rem;">
                  ${index + 1}. ${question.question_text}
                </p>
                ${question.options && question.options.length > 0 ? `
                  <div style="margin-left: 1.5rem; margin-top: 0.5rem;">
                    ${question.options.map(option => `
                      <div style="display: flex; align-items: center; margin-bottom: 0.25rem;">
                        <span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #cbd5e1; margin-right: 0.5rem;"></span>
                        <span>${option.label}${option.value !== undefined ? ` (${option.value})` : ''}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${assessment.scoring_system ? `
          <div class="section">
            <h2>Scoring System</h2>
            <p>${assessment.scoring_system}</p>
          </div>
          ` : ''}

          ${assessment.contraindications ? `
          <div class="section">
            <h2 style="color: #dc2626;">Contraindications</h2>
            <p style="color: #b91c1c;">${assessment.contraindications}</p>
          </div>
          ` : ''}

          <div class="section">
            <h2>Summary & Clinical Notes</h2>
            <div class="field">
              <label>Total Score:</label>
              <p>___________________ ${assessment.unit_of_measure || ''}</p>
            </div>
            <div class="field">
              <label>Risk Level/Interpretation:</label>
              <p>_______________________________________________</p>
            </div>
            <div class="field">
              <label>Clinical Observations:</label>
              <div class="notes-box"></div>
            </div>
            <div class="field">
              <label>Recommendations:</label>
              <div class="notes-box"></div>
            </div>
            ${getAssessmentReference(assessment.name) ? `
            <div class="field">
              <label>Reference:</label>
              <p style="font-size: 12px; font-style: italic;">${getAssessmentReference(assessment.name)}</p>
            </div>
            ` : ''}
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleAddToClient = () => {
    if (onAddToClient) {
      onAddToClient(assessment);
    }
  };

  const handleRunTestNow = () => {
    setShowTestRunner(true);
  };

  const handleQuestionnaireComplete = (data) => {
    setShowQuestionnaireRunner(false);
    toast.success(`Questionnaire completed! Score: ${data.totalScore}`);
    onClose();
  };

  const handleAssessmentUpdated = async () => {
    // Reload assessment data
    const updated = await base44.entities.Assessment.get(assessment.id);
    setCurrentAssessment(updated);
    setShowEditModal(false);
    setShowEditQualityChecks(false);
    toast.success("Assessment updated!");
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      
      {showEditModal ? (
        <EditAssessmentModal
          assessment={currentAssessment}
          onClose={() => setShowEditModal(false)}
          onSaved={handleAssessmentUpdated}
        />
      ) : showEditQualityChecks ? (
        <EditQualityChecksModal
          assessment={currentAssessment}
          onClose={() => setShowEditQualityChecks(false)}
          onSaved={handleAssessmentUpdated}
        />
      ) : showQuestionnaireRunner ? (
        <QuestionnaireRunner
          assessment={assessment}
          onSave={handleQuestionnaireComplete}
          onClose={() => {
            setShowQuestionnaireRunner(false);
            onClose();
          }}
          isStandaloneMode={true}
        />
      ) : showTestRunner ? (
        <AssessmentTestRunnerRouter
          assessment={assessment}
          onClose={() => {
            setShowTestRunner(false);
            onClose();
          }}
          isStandaloneMode={true}
        />
      ) : (
        <div 
          ref={scrollContainerRef}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
          onClick={handleBackdropClick}
        >
          <div ref={topSentinelRef} className="h-0" />
          <div className="min-h-full flex items-start justify-center p-4 sm:p-6">
            <Card className="w-full max-w-5xl bg-white my-4 shadow-2xl rounded-2xl">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold text-slate-900 mb-2">
                {currentAssessment.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={`${getCategoryColor(currentAssessment.category)} border-0 w-fit`}>
                  {formatCategory(currentAssessment.category)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Unit: {currentAssessment.unit_of_measure || 'N/A'}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="space-y-8 px-6 pb-8">

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Description</h3>
              <p className="text-slate-700">{currentAssessment.description}</p>
            </div>

            {/* Instructions - always shown */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Clinician Instructions</h3>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-slate-700 whitespace-pre-wrap">
                  {currentAssessment.instructions || `Administer the ${currentAssessment.name} according to standardised protocol. ${currentAssessment.equipment_needed ? `\n\nEquipment: ${currentAssessment.equipment_needed}` : ''} ${currentAssessment.scoring_system ? `\n\nScoring: ${currentAssessment.scoring_system}` : ''}`}
                </p>
              </div>
            </div>

            {/* Scoring System */}
            {currentAssessment.scoring_system && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Scoring System</h3>
                <p className="text-slate-700">{currentAssessment.scoring_system}</p>
              </div>
            )}

            {/* Equipment & Unit */}
            <div className="grid md:grid-cols-2 gap-6">
              {currentAssessment.unit_of_measure && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Unit of Measure</h3>
                  <p className="text-slate-700">{currentAssessment.unit_of_measure}</p>
                </div>
              )}
              {currentAssessment.equipment_needed && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Equipment Needed</h3>
                  <p className="text-slate-700">{currentAssessment.equipment_needed}</p>
                </div>
              )}
            </div>

            {/* Contraindications */}
            {currentAssessment.contraindications && (
              <div>
                <h3 className="text-lg font-semibold text-red-600 mb-2">Contraindications</h3>
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <p className="text-red-700">{currentAssessment.contraindications}</p>
                </div>
              </div>
            )}

            {/* Conditions & Tags */}
            <div className="grid md:grid-cols-2 gap-6">
              {currentAssessment.conditions_indicated && currentAssessment.conditions_indicated.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Indicated Conditions</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentAssessment.conditions_indicated.map((condition, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {currentAssessment.search_tags && currentAssessment.search_tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Search Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentAssessment.search_tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Normative Data */}
            {currentAssessment.normative_data && currentAssessment.normative_data.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Normative Data</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Age Range</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Gender</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Mean</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Std Dev</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">25th %ile</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">75th %ile</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {currentAssessment.normative_data.map((norm, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 text-sm text-slate-900">{norm.age_min}-{norm.age_max}</td>
                          <td className="px-3 py-2 text-sm text-slate-900 capitalize">{norm.gender}</td>
                          <td className="px-3 py-2 text-sm text-slate-900">{norm.mean}</td>
                          <td className="px-3 py-2 text-sm text-slate-900">{norm.std_dev}</td>
                          <td className="px-3 py-2 text-sm text-slate-900">{norm.percentile_25}</td>
                          <td className="px-3 py-2 text-sm text-slate-900">{norm.percentile_75}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* References */}
            {(currentAssessment.references || getAssessmentReference(currentAssessment.name)) && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    References
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <ClickableReferences references={currentAssessment.references || getAssessmentReference(currentAssessment.name)} />
                  </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
              <Button onClick={handleDownloadForm} variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download Form
              </Button>
              <Button onClick={handleRunTestNow} className="flex-1 bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Run Test Now
              </Button>
              {onAddToClient && (
                <Button onClick={handleAddToClient} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Client
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
          </div>
      </div>
      )}
    </>
  );
}