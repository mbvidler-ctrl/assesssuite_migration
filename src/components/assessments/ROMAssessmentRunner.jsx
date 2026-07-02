import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Save, Info, Target, MessageSquare, Ruler } from "lucide-react";

// ROM Data for all joints
const ROM_DATA = {
  cervical_spine: {
    name: "Cervical Spine",
    description: "Active range of motion of the cervical spine measured with a goniometer. Includes flexion, extension, lateral flexion, and rotation.",
    globalNotes: "These cervical ROM norms are approximate international clinical standards and will vary slightly between sources. Use them as a guide rather than an absolute pass/fail threshold. Always document symptom behaviour, quality of movement, and any red flags (neurological symptoms, dizziness, visual disturbance) alongside raw ROM numbers.",
    movements: [
      {
        name: "Flexion",
        plane: "Sagittal",
        normal: { male: "40-55Â°", female: "45-60Â°", combined: "40-60Â°" },
        goniometer: {
          axis: "External auditory meatus (or just anterior to the tragus of the ear)",
          stationary_arm: "Vertically aligned (perpendicular to the floor)",
          moving_arm: "Aligned with the base of the nares (or tip of nose) so that it moves as the head flexes"
        },
        landmarks: "External auditory meatus / tragus of the ear, tip of the nose or base of the nares, sternum / manubrium (observe to ensure trunk flexion is not substituted for neck flexion)",
        position: "Sitting upright on a chair, feet flat, thoracic spine supported or verbally cued to stay still. Eyes looking forward at start.",
        script: "\"Sit up tall with your shoulders relaxed. Keep your shoulders and upper back as still as you can. When I say go, gently tuck your chin and bend your neck forward as if you're looking down at your chest. Go as far as you comfortably can, but stop if you feel sharp pain, dizziness, or anything unusual. Hold that position while I measure, then slowly return to your starting position.\"",
        interpretation: "Typical active cervical flexion in healthy adults is around 40â€“60Â°. Values significantly below this range may reflect stiffness, pain limitation, guarding, or neurological involvement. Compare side-to-side patterns across other planes and consider symptom reproduction."
      },
      {
        name: "Extension",
        plane: "Sagittal",
        normal: { male: "50-70Â°", female: "50-75Â°", combined: "50-70Â°" },
        goniometer: {
          axis: "External auditory meatus / tragus",
          stationary_arm: "Vertically aligned (perpendicular to the floor)",
          moving_arm: "Aligned with the base of the nares or tip of the nose"
        },
        landmarks: "External auditory meatus / tragus, base of nares or tip of nose, observe sternum and upper chest to minimise trunk extension",
        position: "Sitting upright on a chair, feet flat, thoracic spine stable. Eyes looking forward at start.",
        script: "\"Sit up tall with your shoulders relaxed. Keep your upper back as still as possible. When I say go, gently look up toward the ceiling as far as is comfortable without forcing it. Stop if you feel dizziness, blurred vision, or sharp pain. Hold that position while I measure, then slowly return to neutral.\"",
        interpretation: "Normal active extension is typically 50â€“70Â°. Reduced extension may be related to facet joint irritation, disc pathology, postural changes, or fear-avoidance. Monitor for vestibular or vertebrobasilar symptoms."
      },
      {
        name: "Lateral Flexion (Left)",
        plane: "Frontal",
        normal: { male: "35-45Â°", female: "35-50Â°", combined: "35-45Â°" },
        goniometer: {
          axis: "Spinous process of C7",
          stationary_arm: "Along the thoracic spine, vertical (perpendicular to the floor)",
          moving_arm: "With the midline of the head (through the occipital protuberance or midpoint between the ears)"
        },
        landmarks: "C7 spinous process (palpate the most prominent lower cervical spinous process), midline of the head (bump of the occiput or midpoint between the ears). Ensure the client does not rotate or flex/extend while side-bending.",
        position: "Sitting upright, feet flat, thoracic spine stable, looking straight ahead.",
        script: "\"Sit up tall and look straight ahead. Try to keep your shoulders level. When I say go, gently bring your left ear toward your left shoulder without turning your head. Go as far as is comfortable. Don't lift the shoulder up to meet the ear. Hold that position for a moment while I measure, then relax back to the middle.\"",
        interpretation: "Normal lateral flexion is approximately 35â€“45Â°. Asymmetry between sides, or reproduction of arm symptoms, may indicate foraminal narrowing, nerve root irritation, or muscular imbalance."
      },
      {
        name: "Lateral Flexion (Right)",
        plane: "Frontal",
        normal: { male: "35-45Â°", female: "35-50Â°", combined: "35-45Â°" },
        goniometer: {
          axis: "Spinous process of C7",
          stationary_arm: "Along the thoracic spine, vertical (perpendicular to the floor)",
          moving_arm: "With the midline of the head (through the occipital protuberance or midpoint between the ears)"
        },
        landmarks: "C7 spinous process, head midline. Observe for compensation (rotation or flexion/extension).",
        position: "Sitting upright, feet flat, thoracic spine stable, looking straight ahead.",
        script: "\"Sit tall and look straight ahead. Keep your shoulders level. When I say go, gently bring your right ear toward your right shoulder without turning your head. Only go as far as is comfortable. Hold that position for a moment while I measure, then return to the middle.\"",
        interpretation: "Compare left vs right. Differences >5â€“10Â° plus symptom reproduction may be clinically relevant. Consider muscle length, joint restrictions, and neural involvement."
      },
      {
        name: "Rotation (Left)",
        plane: "Transverse",
        normal: { male: "60-80Â°", female: "65-85Â°", combined: "60-80Â°" },
        goniometer: {
          axis: "Over the centre of the head (approx. over the top of the skull)",
          stationary_arm: "Parallel to an imaginary line between the acromion processes or along the shoulders",
          moving_arm: "With the tip of the nose"
        },
        landmarks: "Approximate vertex of the skull for fulcrum (use a visual point), tip of the nose, line between acromion processes (or use an external reference like the frontal plane of the shoulders)",
        position: "Sitting upright or supine, depending on preference. For goniometer measurement, sitting is common; for inclinometer, supine is often easier.",
        script: "\"Sit up tall and look straight ahead. When I say go, turn your head to look over your left shoulder as if you're checking behind you. Move smoothly and stop when you feel a comfortable limit or if you feel pain, dizziness, or visual changes. Hold that end position while I take the measurement, then return to facing forward.\"",
        interpretation: "Normal cervical rotation is roughly 60â€“80Â°. Marked limitation or symptom reproduction (especially dizziness or visual disturbance) may suggest upper cervical involvement, vertebrobasilar insufficiency, or facet joint restriction and warrants cautious progression."
      },
      {
        name: "Rotation (Right)",
        plane: "Transverse",
        normal: { male: "60-80Â°", female: "65-85Â°", combined: "60-80Â°" },
        goniometer: {
          axis: "At top/centre of the skull",
          stationary_arm: "Aligned with acromion line / shoulders",
          moving_arm: "Aligned with the tip of the nose as the head rotates"
        },
        landmarks: "Top of skull (visual), tip of nose, and shoulder line. Ensure trunk does not rotate with the head; cue the client to keep shoulders facing forward.",
        position: "Sitting upright or supine, consistent with the method used on the left side.",
        script: "\"Sit tall and look straight ahead. When I say go, slowly turn your head to look over your right shoulder. Go only as far as is comfortable and stop if you feel dizziness, nausea, or sharp pain. Hold that position briefly while I measure, then return to centre.\"",
        interpretation: "Compare left and right rotation. Asymmetry â‰¥10Â° with concordant symptoms may guide manual therapy, mobility work, or referral for further medical review if red flags are present."
      }
    ]
  },
  thoracic_spine: {
    name: "Thoracic Spine",
    description: "Active thoracic spine range of motion measured with a goniometer or inclinometer. Movements include rotation, extension, and lateral flexion.",
    globalNotes: "Thoracic ROM is naturally smaller than cervical or lumbar due to rib attachments. Pain, stiffness, postural changes, or breathing mechanics can influence results.",
    movements: [
      {
        name: "Rotation (Left)",
        plane: "Transverse",
        normal: { male: "28-32Â°", female: "30-36Â°", combined: "30-35Â°" },
        goniometer: {
          axis: "Best measured with an inclinometer or goniometer atop the shoulders. Method 1 (Dual Inclinometer): Place one inclinometer at T1, another at T12. Have client rotate; subtract lower value from upper. Method 2 (Goniometer): Fulcrum placed on the top of the head.",
          stationary_arm: "Parallel to an imaginary line between the two iliac crests (or parallel to pelvis)",
          moving_arm: "Parallel to an imaginary line between the two acromion processes"
        },
        landmarks: "Spinous process of T1, spinous process of T12 (approx. midpoint between inferior scapular angle and lumbar junction), acromion processes (for goniometer method)",
        position: "Sitting upright with legs supported. Arms crossed over the chest or hands placed on shoulders. Pelvis stabilised manually or verbally cued to avoid lumbar rotation.",
        script: "\"Sit tall with your arms crossed over your chest. When I say go, turn your upper body to the left as if looking behind you, but keep your hips and lower back still. Stop when you feel a comfortable limit or any symptoms. Hold that end position while I measure you.\"",
        interpretation: "Typical right thoracic rotation is around 30â€“35Â°. Large asymmetry (>10Â°) may suggest facet joint stiffness, rib dysfunction, or muscle imbalance."
      },
      {
        name: "Rotation (Right)",
        plane: "Transverse",
        normal: { male: "28-32Â°", female: "30-36Â°", combined: "30-35Â°" },
        goniometer: {
          axis: "Same as left rotation - inclinometer at T1 and T12, or goniometer at vertex",
          stationary_arm: "Parallel to pelvis/iliac crests",
          moving_arm: "Parallel to acromion processes"
        },
        landmarks: "T1, T12, and acromions. Ensure pelvis stays centred.",
        position: "Same as left rotation.",
        script: "\"Sit tall with arms crossed. When I say go, rotate to the right only with your upper back. Keep your pelvis facing forward. Hold at the end while I measure.\"",
        interpretation: "Compare to left side. Asymmetry may indicate mid-thoracic mobility deficits."
      },
      {
        name: "Extension",
        plane: "Sagittal",
        normal: { male: "12-18Â°", female: "15-22Â°", combined: "15-20Â°" },
        goniometer: {
          axis: "Use dual inclinometer: Upper inclinometer at T1, lower inclinometer at T12. Subtract T12 reading from T1 reading. Alternatively, visually estimate using goniometer with fulcrum at mid-thoracic region.",
          stationary_arm: "Aligned with lower thoracic/upper lumbar spine",
          moving_arm: "Aligned with upper thoracic spine"
        },
        landmarks: "T1 and T12. Observe sternum for excessive lumbar extension substitution.",
        position: "Sitting or standing. Hands placed behind head or arms crossed to stabilise rib cage.",
        script: "\"Sit tall. When I say go, gently lift your chest upward and backward as if opening your rib cage. Keep your lower back stable and avoid leaning from the hips.\"",
        interpretation: "Thoracic extension is limited by rib mechanics and vertebral anatomy. Restrictions often relate to posture, thoracic stiffness, or pain provocation."
      },
      {
        name: "Lateral Flexion (Left)",
        plane: "Frontal",
        normal: { male: "15-18Â°", female: "16-22Â°", combined: "15-20Â°" },
        goniometer: {
          axis: "Place inclinometer at T1 and T12; subtract values. For goniometer: Fulcrum at T1.",
          stationary_arm: "Vertical (perpendicular to floor)",
          moving_arm: "Aligned with spine midline"
        },
        landmarks: "T1 and T12. Observe for rib elevation, shoulder hiking, or lumbar substitution.",
        position: "Sitting upright, hands resting lightly on thighs. Avoid lumbar side-bending.",
        script: "\"Sit tall. Slide your rib cage to the left side as if bringing your shoulder toward your hip, without rotating forward or backward.\"",
        interpretation: "Thoracic side-bending is naturally limited. Asymmetry and pain reproduction help differentiate costovertebral vs muscular issues."
      },
      {
        name: "Lateral Flexion (Right)",
        plane: "Frontal",
        normal: { male: "15-18Â°", female: "16-22Â°", combined: "15-20Â°" },
        goniometer: {
          axis: "Place inclinometer at T1 and T12; subtract values. For goniometer: Fulcrum at T1.",
          stationary_arm: "Vertical (perpendicular to floor)",
          moving_arm: "Aligned with spine midline"
        },
        landmarks: "T1 and T12. Observe for rib elevation, shoulder hiking, or lumbar substitution.",
        position: "Sitting upright, hands resting lightly on thighs. Avoid lumbar side-bending.",
        script: "\"Sit tall. Slide your rib cage to the right side as if bringing your shoulder toward your hip, without rotating forward or backward.\"",
        interpretation: "Compare to left side. Asymmetry and pain reproduction help differentiate costovertebral vs muscular issues."
      }
    ]
  },
  lumbar_spine: {
    name: "Lumbar Spine",
    description: "Lumbar lordosis mobility measured with inclinometer or goniometer. Includes flexion, extension, lateral flexion, and rotation.",
    globalNotes: "Lumbar ROM varies based on age, posture, pain, and conditioning. Always combine ROM findings with neurological exam, symptom reproduction, and movement quality.",
    movements: [
      {
        name: "Flexion",
        plane: "Sagittal",
        normal: { male: "40-60Â°", female: "45-65Â°", combined: "40-60Â°" },
        goniometer: {
          axis: "Dual inclinometer method (gold standard): Place the upper inclinometer at T12, place the lower inclinometer at S1. Client flexes forward; subtract S1 from T12.",
          stationary_arm: "Lower inclinometer at S1 (sacral base)",
          moving_arm: "Upper inclinometer at T12 (lower thoracic spine)"
        },
        landmarks: "T12 (lower thoracic spine), S1 (midline at sacral base). Ensure movement originates at lumbar spine and not all from hips/hamstrings. Fingertip-to-floor method acceptable when no inclinometer is available.",
        position: "Standing, feet hip-width apart, knees extended.",
        script: "\"Stand tall with knees straight. When I say go, slowly lean forward and reach toward the floor. Keep your knees straight but do not force the movement. Hold at the end while I measure.\"",
        interpretation: "Normal flexion is 40â€“60Â°. Restrictions may relate to hamstring tightness, discogenic pain, fear-avoidance, or facet joint irritation."
      },
      {
        name: "Extension",
        plane: "Sagittal",
        normal: { male: "20-30Â°", female: "25-35Â°", combined: "20-35Â°" },
        goniometer: {
          axis: "Dual inclinometer: Upper at T12, lower at S1. Subtract S1 from T12 during extension.",
          stationary_arm: "Lower inclinometer at S1",
          moving_arm: "Upper inclinometer at T12"
        },
        landmarks: "T12 and S1. Watch for hip thrust compensation.",
        position: "Standing with hands on hips.",
        script: "\"Stand tall. Gently arch backward by lifting your chest upward. Keep hips under your body and avoid pushing your pelvis forward.\"",
        interpretation: "Painful extension may indicate facet joint loading or spondylolysis."
      },
      {
        name: "Lateral Flexion (Left)",
        plane: "Frontal",
        normal: { male: "20-30Â°", female: "22-32Â°", combined: "20-30Â°" },
        goniometer: {
          axis: "Dual inclinometer at T12 and S1",
          stationary_arm: "Lower inclinometer at S1",
          moving_arm: "Upper inclinometer at T12"
        },
        landmarks: "T12 and S1. Watch for trunk rotation or hip hiking.",
        position: "Standing, arms relaxed at sides.",
        script: "\"Stand tall. Slide your left hand down the side of your left leg without leaning forward or backward.\"",
        interpretation: "Observe movement quality in addition to degrees. Right/left discrepancies >10Â° may be significant."
      },
      {
        name: "Lateral Flexion (Right)",
        plane: "Frontal",
        normal: { male: "20-30Â°", female: "22-32Â°", combined: "20-30Â°" },
        goniometer: {
          axis: "Dual inclinometer at T12 and S1",
          stationary_arm: "Lower inclinometer at S1",
          moving_arm: "Upper inclinometer at T12"
        },
        landmarks: "T12 and S1. Watch for trunk rotation or hip hiking.",
        position: "Standing, arms relaxed at sides.",
        script: "\"Stand tall. Slide your right hand down the side of your right leg without leaning forward or backward.\"",
        interpretation: "Observe movement quality in addition to degrees. Right/left discrepancies >10Â° may be significant."
      },
      {
        name: "Rotation (Left)",
        plane: "Transverse",
        normal: { male: "5-15Â°", female: "5-15Â°", combined: "5-15Â°" },
        goniometer: {
          axis: "Place inclinometer at T12. Measure upper trunk rotation while pelvis remains fixed.",
          stationary_arm: "Pelvis (fixed)",
          moving_arm: "Upper trunk at T12"
        },
        landmarks: "T12. Palpate pelvis to ensure stability.",
        position: "Sitting with pelvis fixed (knees between clinician's legs or supported).",
        script: "\"Sit upright. Turn your upper body to the left without moving your hips.\"",
        interpretation: "Lumbar rotation is small due to facet orientation. Over-rotation usually indicates thoracic compensation."
      },
      {
        name: "Rotation (Right)",
        plane: "Transverse",
        normal: { male: "5-15Â°", female: "5-15Â°", combined: "5-15Â°" },
        goniometer: {
          axis: "Place inclinometer at T12. Measure upper trunk rotation while pelvis remains fixed.",
          stationary_arm: "Pelvis (fixed)",
          moving_arm: "Upper trunk at T12"
        },
        landmarks: "T12. Palpate pelvis to ensure stability.",
        position: "Sitting with pelvis fixed (knees between clinician's legs or supported).",
        script: "\"Sit upright. Turn your upper body to the right without moving your hips.\"",
        interpretation: "Lumbar rotation is small due to facet orientation. Over-rotation usually indicates thoracic compensation."
      }
    ]
  },
  shoulder: {
    name: "Shoulder (Glenohumeral Joint)",
    description: "Active and passive range of motion of the shoulder using a universal goniometer. Movements include flexion, extension, abduction, adduction, internal rotation, external rotation, and functional movements.",
    globalNotes: "Shoulder ROM should always include pain response, movement quality, compensatory patterns, and scapular control. Compare left and right.",
    movements: [
      {
        name: "Flexion",
        plane: "Sagittal",
        normal: { male: "165-180Â°", female: "170-185Â°", combined: "0-180Â°" },
        goniometer: {
          axis: "Lateral aspect of the greater tubercle",
          stationary_arm: "Parallel to the midaxillary line of the thorax",
          moving_arm: "Aligned with the lateral midline of the humerus toward the lateral epicondyle"
        },
        landmarks: "Greater tubercle (lateral proximal humerus), midaxillary line, lateral epicondyle of humerus",
        position: "Standing or supine. Arm at side, thumb pointing up (neutral rotation). Scapula stabilised manually or cued not to elevate.",
        script: "\"Keep your elbow straight and thumb pointing up. Raise your arm forward as high as you comfortably can. Stop if you feel pain or pinching. Hold the top position while I measure.\"",
        interpretation: "Limited flexion may indicate capsular tightness, impingement, rotator cuff pathology, or thoracic stiffness."
      },
      {
        name: "Extension",
        plane: "Sagittal",
        normal: { male: "50-60Â°", female: "45-55Â°", combined: "0-60Â°" },
        goniometer: {
          axis: "Lateral aspect of greater tubercle",
          stationary_arm: "Midaxillary line of thorax",
          moving_arm: "Lateral midline of humerus"
        },
        landmarks: "Greater tubercle, midaxillary line, lateral humerus",
        position: "Standing or prone. Arm in neutral, elbow extended. No lumbar extension.",
        script: "\"With your elbow straight, move your arm backward behind you. Don't lean forward or arch your back. Hold it while I measure.\"",
        interpretation: "Restriction often indicates anterior shoulder tightness (pectoralis major/minor) or GH joint stiffness."
      },
      {
        name: "Abduction",
        plane: "Frontal",
        normal: { male: "170-180Â°", female: "175-185Â°", combined: "0-180Â°" },
        goniometer: {
          axis: "Anterior aspect of acromion process",
          stationary_arm: "Parallel to sternum",
          moving_arm: "Midline of humerus toward medial epicondyle"
        },
        landmarks: "Acromion process and humeral alignment points",
        position: "Standing or supine. Arm in external rotation (thumb up) to avoid impingement.",
        script: "\"Raise your arm out to the side like a snow angel, keeping it straight. Stop when you reach your comfortable limit. Hold there for measurement.\"",
        interpretation: "Restricted abduction may reflect rotator cuff weakness, deltoid dysfunction, adhesive capsulitis, or AC joint issues."
      },
      {
        name: "Adduction",
        plane: "Frontal",
        normal: { male: "0-30Â°", female: "0-30Â°", combined: "0-30Â°" },
        goniometer: {
          axis: "Same setup as abduction. Measure movement across the body.",
          stationary_arm: "Parallel to sternum",
          moving_arm: "Midline of humerus"
        },
        landmarks: "Sternum and humeral epicondyle alignment",
        position: "Standing or supine.",
        script: "\"Bring your arm across your body toward your opposite hip/chest.\"",
        interpretation: "Adduction limitations may occur with tight posterior capsule or rotator cuff pathology."
      },
      {
        name: "External Rotation (90Â° Abducted)",
        plane: "Transverse",
        normal: { male: "80-90Â°", female: "85-95Â°", combined: "0-90Â°" },
        goniometer: {
          axis: "Olecranon",
          stationary_arm: "Perpendicular to floor",
          moving_arm: "Ulnar border toward ulnar styloid"
        },
        landmarks: "Olecranon, ulnar border, and vertical reference",
        position: "Supine. Shoulder abducted to 90Â°, elbow flexed to 90Â°, towel under humerus.",
        script: "\"With your elbow bent and arm out to the side, rotate your hand backward toward the table. Keep your elbow in line. Stop at discomfort.\"",
        interpretation: "Limited ER suggests capsular restriction or rotator cuff involvement. Excessive ER may suggest instability."
      },
      {
        name: "Internal Rotation (90Â° Abducted)",
        plane: "Transverse",
        normal: { male: "60-70Â°", female: "65-75Â°", combined: "0-70Â°" },
        goniometer: {
          axis: "Olecranon",
          stationary_arm: "Perpendicular to floor",
          moving_arm: "Ulnar border of forearm"
        },
        landmarks: "Olecranon and ulnar border",
        position: "Supine, shoulder at 90Â° abduction, elbow at 90Â°.",
        script: "\"Rotate your hand down toward the floor as if lowering it toward your stomach. Keep your elbow still. Hold it there while I measure.\"",
        interpretation: "Limited IR is common in overhead athletes and frozen shoulder. Consider posterior capsule tightness."
      },
      {
        name: "Hand Behind Back (HBB)",
        plane: "Functional",
        normal: { male: "T7-T10", female: "T5-T8", combined: "Measure vertebral level reached (C7-L5 scale)" },
        goniometer: {
          axis: "Not typically used; record vertebral level",
          stationary_arm: "N/A",
          moving_arm: "N/A"
        },
        landmarks: "Vertebral levels via palpation or visual estimation",
        position: "Standing.",
        script: "\"Slide your hand up your back as far as possible without forcing it and tell me when you reach the highest point you can.\"",
        interpretation: "HBB assesses IR, extension, adduction, and scapular motion."
      },
      {
        name: "Hand Behind Head (HBH)",
        plane: "Functional",
        normal: { male: "Full", female: "Full", combined: "Record elbow position relative to midline" },
        goniometer: {
          axis: "Observation only",
          stationary_arm: "N/A",
          moving_arm: "N/A"
        },
        landmarks: "Elbow-to-ear distance and alignment",
        position: "Standing.",
        script: "\"Place your hand behind your head and let your elbow point outward. Hold that position.\"",
        interpretation: "HBH assesses ER, abduction, and scapular upward rotation."
      }
    ]
  },
  elbow: {
    name: "Elbow & Forearm",
    description: "Range of motion of the elbow and forearm using goniometry. Includes flexion, extension, pronation, and supination.",
    globalNotes: "Elbow/forearm ROM should be compared bilaterally, considering functional asymmetry in dominant vs non-dominant limbs.",
    movements: [
      {
        name: "Flexion",
        plane: "Sagittal",
        normal: { male: "140-150Â°", female: "145-155Â°", combined: "0-150Â°" },
        goniometer: {
          axis: "Lateral epicondyle of humerus",
          stationary_arm: "Aligned with humerus toward acromion",
          moving_arm: "Aligned with radius toward radial styloid"
        },
        landmarks: "Lateral epicondyle, humeral shaft, radial styloid",
        position: "Supine or sitting. Shoulder neutral, forearm supinated, towel under humerus.",
        script: "\"Bend your elbow as far as you comfortably can. Try to keep your arm by your side.\"",
        interpretation: "Limitations may reflect biceps tightness, capsular stiffness, or osteoarthritis."
      },
      {
        name: "Extension",
        plane: "Sagittal",
        normal: { male: "0Â°", female: "0-10Â°", combined: "0Â° (Â± 5-10Â° hyperextension normal)" },
        goniometer: {
          axis: "Lateral epicondyle of humerus",
          stationary_arm: "Aligned with humerus toward acromion",
          moving_arm: "Aligned with radius toward radial styloid"
        },
        landmarks: "Lateral epicondyle and radial styloid for alignment",
        position: "Supine or seated, arm supported.",
        script: "\"Straighten your elbow as far as you can. Try not to lift your shoulder.\"",
        interpretation: "Lack of extension may relate to joint effusion, triceps stiffness, or capsular restriction."
      },
      {
        name: "Supination",
        plane: "Transverse",
        normal: { male: "0-80Â°", female: "0-80Â°", combined: "0-80Â°" },
        goniometer: {
          axis: "Medial and proximal to ulnar styloid",
          stationary_arm: "Parallel to humerus",
          moving_arm: "Across volar surface of wrist, just proximal to radial/ulnar styloids"
        },
        landmarks: "Ulnar styloid and volar wrist midline",
        position: "Sitting, elbow flexed to 90Â°, arm tight to torso, forearm neutral.",
        script: "\"Turn your palm upward like you're holding a bowl. Keep your elbow tucked in.\"",
        interpretation: "Supination deficits often reflect distal radioulnar joint issues or interosseous membrane tightness."
      },
      {
        name: "Pronation",
        plane: "Transverse",
        normal: { male: "0-80Â°", female: "0-80Â°", combined: "0-80Â°" },
        goniometer: {
          axis: "Lateral and proximal to ulnar styloid",
          stationary_arm: "Parallel to humerus",
          moving_arm: "Across dorsal wrist proximal to styloids"
        },
        landmarks: "Dorsal wrist midline",
        position: "Sitting, elbow 90Â°, arm by side.",
        script: "\"Turn your palm downward like you're tipping out water. Keep elbow close to your body.\"",
        interpretation: "Pronation limitations may indicate pronator teres tightness, DRUJ restriction, or radial head involvement."
      }
    ]
  },
  wrist: {
    name: "Wrist & Hand",
    description: "Active ROM of wrist and finger joints using a universal goniometer. Includes wrist flexion, extension, radial/ulnar deviation, and hand/finger ROM.",
    globalNotes: "Hand ROM should be interpreted alongside grip strength, dexterity, swelling, and pain location, especially post-injury or chronic conditions.",
    movements: [
      {
        name: "Wrist Flexion",
        plane: "Sagittal",
        normal: { male: "70-80Â°", female: "75-85Â°", combined: "0-80Â°" },
        goniometer: {
          axis: "Lateral aspect of wrist at triquetrum",
          stationary_arm: "Aligned with ulna toward olecranon",
          moving_arm: "Aligned with fifth metacarpal"
        },
        landmarks: "Triquetrum (ulnar side of wrist), ulna, and 5th metacarpal",
        position: "Sitting. Forearm supported on table, hand free over edge, palm down.",
        script: "\"Gently bend your hand downward at the wrist. Keep your forearm on the table.\"",
        interpretation: "Reduced flexion may reflect capsular tightness, carpal instability, or flexor tendon involvement."
      },
      {
        name: "Wrist Extension",
        plane: "Sagittal",
        normal: { male: "0-70Â°", female: "0-70Â°", combined: "0-70Â°" },
        goniometer: {
          axis: "Triquetrum",
          stationary_arm: "Along ulna",
          moving_arm: "Along 5th metacarpal"
        },
        landmarks: "Same as wrist flexion",
        position: "Forearm pronated, hand over edge of table.",
        script: "\"Lift your hand upward at the wrist without moving your forearm.\"",
        interpretation: "Extension loss may indicate dorsal capsule tightness or post-fracture stiffness."
      },
      {
        name: "Radial Deviation",
        plane: "Frontal",
        normal: { male: "0-20Â°", female: "0-20Â°", combined: "0-20Â°" },
        goniometer: {
          axis: "Dorsal aspect of wrist over capitate",
          stationary_arm: "Aligned with midline of forearm",
          moving_arm: "Aligned with 3rd metacarpal"
        },
        landmarks: "Capitate and 3rd metacarpal midline",
        position: "Forearm pronated, wrist neutral on table.",
        script: "\"Slide your hand toward your thumb side.\"",
        interpretation: "Radial deviation is naturally limited due to radial styloid shape."
      },
      {
        name: "Ulnar Deviation",
        plane: "Frontal",
        normal: { male: "0-30Â°", female: "0-30Â°", combined: "0-30Â°" },
        goniometer: {
          axis: "Dorsal aspect of wrist over capitate",
          stationary_arm: "Aligned with midline of forearm",
          moving_arm: "Aligned with 3rd metacarpal"
        },
        landmarks: "Capitate and 3rd metacarpal",
        position: "Forearm pronated on table.",
        script: "\"Slide your hand toward your little finger.\"",
        interpretation: "Excessive ulnar deviation may relate to ligament laxity or carpal instability."
      },
      {
        name: "Finger MCP Flexion",
        plane: "Sagittal",
        normal: { male: "0-90Â°", female: "0-90Â°", combined: "0-90Â°" },
        goniometer: {
          axis: "Dorsal aspect of MCP joint",
          stationary_arm: "Aligned with metacarpal",
          moving_arm: "Aligned with proximal phalanx"
        },
        landmarks: "Dorsal MCP crease and phalanges",
        position: "Forearm supported, hand relaxed.",
        script: "\"Bend your finger at the big knuckle.\"",
        interpretation: "MCP flexion limitations may indicate capsular tightness or extensor mechanism issues."
      },
      {
        name: "Finger PIP Flexion",
        plane: "Sagittal",
        normal: { male: "0-100Â°", female: "0-100Â°", combined: "0-100Â°" },
        goniometer: {
          axis: "Dorsal PIP joint",
          stationary_arm: "Proximal phalanx",
          moving_arm: "Middle phalanx"
        },
        landmarks: "PIP joint, proximal and middle phalanges",
        position: "Hand supported.",
        script: "\"Bend the middle joint of your finger.\"",
        interpretation: "PIP flexion loss common after finger injuries or with Dupuytren's contracture."
      },
      {
        name: "Finger DIP Flexion",
        plane: "Sagittal",
        normal: { male: "0-80Â°", female: "0-80Â°", combined: "0-80Â°" },
        goniometer: {
          axis: "Dorsal DIP joint",
          stationary_arm: "Middle phalanx",
          moving_arm: "Distal phalanx"
        },
        landmarks: "DIP joint, middle and distal phalanges",
        position: "Hand supported, PIP slightly flexed.",
        script: "\"Bend the tip of your finger.\"",
        interpretation: "DIP flexion loss may indicate mallet finger or FDP involvement."
      },
      {
        name: "Thumb CMC Abduction",
        plane: "Frontal",
        normal: { male: "60-70Â°", female: "60-70Â°", combined: "60-70Â°" },
        goniometer: {
          axis: "CMC joint of the thumb",
          stationary_arm: "Along the 2nd metacarpal",
          moving_arm: "Along the 1st metacarpal"
        },
        landmarks: "CMC joint, 1st metacarpal, 2nd metacarpal",
        position: "Forearm in neutral, palm facing up.",
        script: "\"Move your thumb away from your palm, perpendicular to your hand.\"",
        interpretation: "CMC abduction loss affects grip and pinch strength."
      },
      {
        name: "Thumb MCP Flexion",
        plane: "Sagittal",
        normal: { male: "50-60Â°", female: "50-60Â°", combined: "50-60Â°" },
        goniometer: {
          axis: "Dorsal aspect of the thumb MCP joint",
          stationary_arm: "Along the 1st metacarpal",
          moving_arm: "Along the proximal phalanx of the thumb"
        },
        landmarks: "Thumb MCP joint, 1st metacarpal, thumb proximal phalanx",
        position: "Wrist in neutral.",
        script: "\"Bend your thumb at the big knuckle, toward your palm.\"",
        interpretation: "Thumb MCP flexion important for opposition and pinch."
      },
      {
        name: "Thumb IP Flexion",
        plane: "Sagittal",
        normal: { male: "80-90Â°", female: "80-90Â°", combined: "80-90Â°" },
        goniometer: {
          axis: "Dorsal aspect of the thumb IP joint",
          stationary_arm: "Along the proximal phalanx",
          moving_arm: "Along the distal phalanx"
        },
        landmarks: "Thumb IP joint, proximal phalanx, distal phalanx",
        position: "MCP in neutral or slight flexion.",
        script: "\"Bend the tip of your thumb down as far as you can.\"",
        interpretation: "Thumb IP flexion affects fine motor tasks."
      }
    ]
  },
  hip: {
    name: "Hip",
    description: "Hip range of motion measured with a universal goniometer in all major planes. Includes flexion, extension, abduction, adduction, internal rotation, and external rotation.",
    globalNotes: "Hip ROM is influenced by pelvic stability, femoral version, capsular tightness, and muscular balance.",
    movements: [
      {
        name: "Flexion",
        plane: "Sagittal",
        normal: { male: "110-120Â°", female: "115-125Â°", combined: "0-120Â°" },
        goniometer: {
          axis: "Greater trochanter",
          stationary_arm: "Midline of pelvis",
          moving_arm: "Midline of femur toward lateral epicondyle"
        },
        landmarks: "Greater trochanter and lateral femoral midline",
        position: "Supine. Pelvis kept stable. Opposite leg extended flat on table.",
        script: "\"Bring your knee toward your chest as far as you comfortably can without lifting the other leg.\"",
        interpretation: "Limited flexion may indicate impingement, labral irritation, or capsular tightness."
      },
      {
        name: "Extension",
        plane: "Sagittal",
        normal: { male: "0-20Â°", female: "0-20Â°", combined: "0-20Â°" },
        goniometer: {
          axis: "Greater trochanter",
          stationary_arm: "Midline of pelvis",
          moving_arm: "Midline of femur"
        },
        landmarks: "Identify pelvis to avoid lumbar extension compensation",
        position: "Prone with legs straight, or supine over edge of bed (Thomas test position).",
        script: "\"Lift your leg straight upward without bending your knee.\"",
        interpretation: "Hip extension is strongly influenced by iliopsoas length and anterior capsule mobility."
      },
      {
        name: "Abduction",
        plane: "Frontal",
        normal: { male: "0-45Â°", female: "0-45Â°", combined: "0-45Â°" },
        goniometer: {
          axis: "ASIS of measured side",
          stationary_arm: "Toward opposite ASIS",
          moving_arm: "Midline of femur toward patella"
        },
        landmarks: "Both ASIS to avoid pelvic rotation",
        position: "Supine, legs extended.",
        script: "\"Slide your leg out to the side without rolling your hips.\"",
        interpretation: "Values <30Â° may suggest glute med/min tightness or capsular restriction."
      },
      {
        name: "Adduction",
        plane: "Frontal",
        normal: { male: "0-30Â°", female: "0-30Â°", combined: "0-30Â°" },
        goniometer: {
          axis: "ASIS",
          stationary_arm: "Opposite ASIS line",
          moving_arm: "Midline of femur"
        },
        landmarks: "ASIS and femur alignment",
        position: "Supine with opposite leg abducted slightly.",
        script: "\"Move your leg across your body toward the other leg.\"",
        interpretation: "Adduction limitations may indicate adductor tightness or medial capsule restriction."
      },
      {
        name: "Internal Rotation",
        plane: "Transverse",
        normal: { male: "0-45Â°", female: "0-45Â°", combined: "0-45Â°" },
        goniometer: {
          axis: "Patella",
          stationary_arm: "Perpendicular to floor",
          moving_arm: "Midline of tibia"
        },
        landmarks: "Tibial tuberosity and patella",
        position: "Sitting with hips/knees at 90Â°, towel under thigh.",
        script: "\"Rotate your foot outward, keeping your knee still.\"",
        interpretation: "Limited IR may indicate posterior capsule tightness or femoral retroversion."
      },
      {
        name: "External Rotation",
        plane: "Transverse",
        normal: { male: "0-45Â°", female: "0-45Â°", combined: "0-45Â°" },
        goniometer: {
          axis: "Patella",
          stationary_arm: "Perpendicular to floor",
          moving_arm: "Midline of tibia"
        },
        landmarks: "Tibial tuberosity and patella",
        position: "Same as internal rotation.",
        script: "\"Rotate your foot inward while keeping your knee still.\"",
        interpretation: "Limited ER may indicate anterior capsule tightness or femoral anteversion."
      }
    ]
  },
  knee: {
    name: "Knee",
    description: "Knee flexion and extension measured with a universal goniometer. Includes observation of end-feel and pain.",
    globalNotes: "Knee measurement accuracy requires consistent pelvic stability and alignment of the femur.",
    movements: [
      {
        name: "Flexion",
        plane: "Sagittal",
        normal: { male: "130-135Â°", female: "135-140Â°", combined: "0-135Â°" },
        goniometer: {
          axis: "Lateral epicondyle of femur",
          stationary_arm: "Midline of femur toward greater trochanter",
          moving_arm: "Midline of fibula toward lateral malleolus"
        },
        landmarks: "Greater trochanter, lateral epicondyle, lateral malleolus",
        position: "Supine.",
        script: "\"Slide your heel toward your bottom as far as you comfortably can.\"",
        interpretation: "Limited flexion may indicate capsular tightness, effusion, or quadriceps/patellar involvement."
      },
      {
        name: "Extension",
        plane: "Sagittal",
        normal: { male: "0-5Â°", female: "0-5Â°", combined: "0Â° to +5Â° hyperextension" },
        goniometer: {
          axis: "Lateral epicondyle of femur",
          stationary_arm: "Midline of femur toward greater trochanter",
          moving_arm: "Midline of fibula toward lateral malleolus"
        },
        landmarks: "Same as flexion",
        position: "Supine with heel supported, knee fully relaxed.",
        script: "\"Straighten your knee fully. Let it relax into its end position.\"",
        interpretation: "Loss of extension strongly affects gait. Consider posterior capsule tightness or hamstring involvement."
      }
    ]
  },
  ankle: {
    name: "Ankle",
    description: "Ankle dorsiflexion, plantarflexion, inversion, and eversion measured using a universal goniometer.",
    globalNotes: "Consider knee angle influence when measuring dorsiflexion. Compare to weight-bearing measures if relevant.",
    movements: [
      {
        name: "Dorsiflexion",
        plane: "Sagittal",
        normal: { male: "0-20Â°", female: "0-20Â°", combined: "0-20Â°" },
        goniometer: {
          axis: "Lateral malleolus",
          stationary_arm: "Midline of fibula toward fibular head",
          moving_arm: "Parallel to 5th metatarsal"
        },
        landmarks: "Lateral malleolus, fibula, and 5th metatarsal",
        position: "Sitting or supine with knee flexed to 90Â° (reduces gastrocnemius influence).",
        script: "\"Pull your foot upward toward your shin without lifting your heel.\"",
        interpretation: "Limited dorsiflexion may indicate gastrocnemius/soleus tightness or anterior ankle impingement."
      },
      {
        name: "Plantarflexion",
        plane: "Sagittal",
        normal: { male: "0-50Â°", female: "0-50Â°", combined: "0-50Â°" },
        goniometer: {
          axis: "Lateral malleolus",
          stationary_arm: "Midline of fibula toward fibular head",
          moving_arm: "Parallel to 5th metatarsal"
        },
        landmarks: "Same as dorsiflexion",
        position: "Sitting, knee flexed.",
        script: "\"Point your toes downward like a ballerina.\"",
        interpretation: "Limited plantarflexion may indicate anterior tibialis tightness or posterior ankle restriction."
      },
      {
        name: "Inversion",
        plane: "Frontal",
        normal: { male: "0-35Â°", female: "0-35Â°", combined: "0-35Â°" },
        goniometer: {
          axis: "Anterior ankle midway between malleoli",
          stationary_arm: "Midline of tibia",
          moving_arm: "Midline of 2nd metatarsal"
        },
        landmarks: "Anterior ankle midpoint, tibial crest, 2nd metatarsal",
        position: "Seated with knee flexed, ankle in neutral.",
        script: "\"Turn the sole of your foot inward.\"",
        interpretation: "Excessive inversion may indicate lateral ligament laxity; limited inversion may suggest subtalar stiffness."
      },
      {
        name: "Eversion",
        plane: "Frontal",
        normal: { male: "0-15Â°", female: "0-15Â°", combined: "0-15Â°" },
        goniometer: {
          axis: "Anterior ankle midway between malleoli",
          stationary_arm: "Midline of tibia",
          moving_arm: "Midline of 2nd metatarsal"
        },
        landmarks: "Same as inversion",
        position: "Seated with knee flexed, ankle in neutral.",
        script: "\"Turn the sole of your foot outward.\"",
        interpretation: "Limited eversion may indicate medial ligament tightness or subtalar joint restriction."
      }
    ]
  },
  foot_toes: {
    name: "Foot & Toes",
    description: "First MTP and interphalangeal joint ROM measured with goniometry.",
    globalNotes: "Toe ROM is highly variable and influenced by footwear, joint stiffness, and prior injuries such as turf toe or hallux rigidus.",
    movements: [
      {
        name: "1st MTP Extension (Dorsiflexion)",
        plane: "Sagittal",
        normal: { male: "0-70Â°", female: "0-70Â°", combined: "0-70Â°" },
        goniometer: {
          axis: "MTP joint",
          stationary_arm: "1st metatarsal",
          moving_arm: "Proximal phalanx"
        },
        landmarks: "1st MTP joint, 1st metatarsal, proximal phalanx",
        position: "Sitting.",
        script: "\"Lift your big toe upward while keeping the foot still.\"",
        interpretation: "Limited 1st MTP extension may indicate hallux rigidus or functional hallux limitus affecting gait."
      },
      {
        name: "1st MTP Flexion",
        plane: "Sagittal",
        normal: { male: "0-45Â°", female: "0-45Â°", combined: "0-45Â°" },
        goniometer: {
          axis: "MTP joint",
          stationary_arm: "1st metatarsal",
          moving_arm: "Proximal phalanx"
        },
        landmarks: "1st MTP joint, 1st metatarsal, proximal phalanx",
        position: "Sitting.",
        script: "\"Curl your big toe downward.\"",
        interpretation: "Limited flexion may indicate FHL tightness or plantar plate involvement."
      },
      {
        name: "Toe IP Flexion",
        plane: "Sagittal",
        normal: { male: "0-50Â° to 0-80Â°", female: "0-50Â° to 0-80Â°", combined: "0-50Â° to 0-80Â° (varies by toe)" },
        goniometer: {
          axis: "IP joint",
          stationary_arm: "Proximal phalanx",
          moving_arm: "Distal phalanx"
        },
        landmarks: "IP joint, proximal and distal phalanges",
        position: "Sitting, foot supported.",
        script: "\"Curl your toes downward.\"",
        interpretation: "IP flexion contractures common with hammer toe deformities."
      },
      {
        name: "Toe IP Extension",
        plane: "Sagittal",
        normal: { male: "0-30Â°", female: "0-30Â°", combined: "0-30Â°" },
        goniometer: {
          axis: "IP joint",
          stationary_arm: "Proximal phalanx",
          moving_arm: "Distal phalanx"
        },
        landmarks: "IP joint, proximal and distal phalanges",
        position: "Sitting, foot supported.",
        script: "\"Lift your toes upward.\"",
        interpretation: "Limited IP extension may indicate flexor tightness or joint stiffness."
      }
    ]
  }
};

const JOINT_OPTIONS = [
  { value: "cervical_spine", label: "Cervical Spine" },
  { value: "thoracic_spine", label: "Thoracic Spine" },
  { value: "lumbar_spine", label: "Lumbar Spine" },
  { value: "shoulder", label: "Shoulder (Glenohumeral)" },
  { value: "elbow", label: "Elbow & Forearm" },
  { value: "wrist", label: "Wrist & Hand" },
  { value: "hip", label: "Hip" },
  { value: "knee", label: "Knee" },
  { value: "ankle", label: "Ankle" },
  { value: "foot_toes", label: "Foot & Toes" }
];

export default function ROMAssessmentRunner({ onSave, onClose, initialData }) {
  const [selectedJoint, setSelectedJoint] = useState(initialData?.joint || "");
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [measurements, setMeasurements] = useState(initialData?.measurements || {});
  const [comments, setComments] = useState(initialData?.comments || {});

  const jointData = selectedJoint ? ROM_DATA[selectedJoint] : null;

  const handleMeasurementChange = (movementName, side, value) => {
    setMeasurements(prev => ({
      ...prev,
      [movementName]: {
        ...prev[movementName],
        [side]: value
      }
    }));
  };

  const handleCommentChange = (movementName, value) => {
    setComments(prev => ({
      ...prev,
      [movementName]: value
    }));
  };

  const handleSave = () => {
    // Build comprehensive SOAP text
    let soapText = `Range of Motion Assessment - ${jointData?.name}\n\n`;
    
    jointData?.movements.forEach(movement => {
      const m = measurements[movement.name];
      if (m?.left || m?.right) {
        soapText += `${movement.name}:\n`;
        if (m.left) soapText += `  Left: ${m.left}Â° (Normal: ${movement.normal.combined})\n`;
        if (m.right) soapText += `  Right: ${m.right}Â° (Normal: ${movement.normal.combined})\n`;
        if (comments[movement.name]) soapText += `  Notes: ${comments[movement.name]}\n`;
        soapText += `\n`;
      }
    });

    const data = {
      joint: selectedJoint,
      jointName: jointData?.name,
      measurements,
      comments,
      additional_data: {
        soap_text: soapText,
        measurement_type: 'rom_assessment'
      },
      assessment_date: new Date().toISOString().split('T')[0]
    };
    if (onSave) onSave(data);
  };

  const generateSOAPObjective = () => {
    if (!jointData) return "";
    
    let text = `ROM Assessment - ${jointData.name}:\n`;
    
    jointData.movements.forEach(movement => {
      const m = measurements[movement.name];
      if (m?.left || m?.right) {
        text += `  ${movement.name}: `;
        if (m.left) text += `L: ${m.left}Â° `;
        if (m.right) text += `R: ${m.right}Â°`;
        text += ` (Normal: ${movement.normal.combined})\n`;
        
        if (comments[movement.name]) {
          text += `    Notes: ${comments[movement.name]}\n`;
        }
      }
    });
    
    return text;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Range of Motion Assessment</h2>
              <p className="text-slate-600 mt-1">Select a joint to view instructions and record measurements</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Joint Selector */}
          <div className="mt-4 max-w-md">
            <Label className="text-sm font-medium mb-2 block">Select Joint to Measure</Label>
            <Select value={selectedJoint} onValueChange={setSelectedJoint}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Choose a joint..." />
              </SelectTrigger>
              <SelectContent>
                {JOINT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedJoint ? (
            <div className="text-center py-12 text-slate-500">
              <Ruler className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Select a joint above to begin the ROM assessment</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Movement Cards */}
              {jointData?.movements.map((movement, index) => (
                <Card key={index} className="border-slate-200">
                  <CardHeader 
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setSelectedMovement(selectedMovement === index ? null : index)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-slate-900">
                        {movement.name}
                      </CardTitle>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Normal: {movement.normal.combined}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Collapsible Instructions */}
                    {selectedMovement === index && (
                      <Tabs defaultValue="norms" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="norms">Norms</TabsTrigger>
                          <TabsTrigger value="goniometer">Goniometer</TabsTrigger>
                          <TabsTrigger value="landmarks">Landmarks</TabsTrigger>
                          <TabsTrigger value="script">Script</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="norms" className="mt-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              Normal ROM Values
                            </h4>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-blue-700 font-medium">Male:</span>
                                <span className="ml-2">{movement.normal.male}</span>
                              </div>
                              <div>
                                <span className="text-blue-700 font-medium">Female:</span>
                                <span className="ml-2">{movement.normal.female}</span>
                              </div>
                              <div>
                                <span className="text-blue-700 font-medium">Combined:</span>
                                <span className="ml-2">{movement.normal.combined}</span>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="goniometer" className="mt-4">
                          <div className="bg-purple-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                              <Target className="w-4 h-4" />
                              Goniometer Placement
                            </h4>
                            <div className="space-y-2 text-sm text-purple-800">
                              <p><strong>Axis:</strong> {movement.goniometer.axis}</p>
                              <p><strong>Stationary Arm:</strong> {movement.goniometer.stationary_arm}</p>
                              <p><strong>Moving Arm:</strong> {movement.goniometer.moving_arm}</p>
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="landmarks" className="mt-4">
                          <div className="bg-amber-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-amber-900 mb-2">Anatomical Landmarks</h4>
                            <p className="text-sm text-amber-800">{movement.landmarks}</p>
                            <div className="mt-3 pt-3 border-t border-amber-200">
                              <p className="text-sm text-amber-800"><strong>Position:</strong> {movement.position}</p>
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="script" className="mt-4">
                          <div className="bg-green-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" />
                              Clinician Script
                            </h4>
                            <p className="text-sm text-green-800 italic">{movement.script}</p>
                          </div>
                        </TabsContent>
                      </Tabs>
                    )}

                    {/* Measurement Inputs - Always visible */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
                      <div>
                        <Label htmlFor={`${movement.name}-left`} className="text-sm">Left Side (Â°)</Label>
                        <Input
                          id={`${movement.name}-left`}
                          type="number"
                          placeholder="Degrees"
                          value={measurements[movement.name]?.left || ""}
                          onChange={(e) => handleMeasurementChange(movement.name, "left", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${movement.name}-right`} className="text-sm">Right Side (Â°)</Label>
                        <Input
                          id={`${movement.name}-right`}
                          type="number"
                          placeholder="Degrees"
                          value={measurements[movement.name]?.right || ""}
                          onChange={(e) => handleMeasurementChange(movement.name, "right", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <Label htmlFor={`${movement.name}-comments`} className="text-sm">Comments</Label>
                        <Input
                          id={`${movement.name}-comments`}
                          type="text"
                          placeholder="Optional notes"
                          value={comments[movement.name] || ""}
                          onChange={(e) => handleCommentChange(movement.name, e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Quick interpretation */}
                    {(measurements[movement.name]?.left || measurements[movement.name]?.right) && (
                      <div className="text-xs text-slate-500 mt-2">
                        {(() => {
                          const left = parseFloat(measurements[movement.name]?.left);
                          const right = parseFloat(measurements[movement.name]?.right);
                          const normalMin = parseFloat(movement.normal.combined.split("-")[0]);
                          
                          const leftStatus = left && left < normalMin ? "Limited" : left ? "WNL" : "";
                          const rightStatus = right && right < normalMin ? "Limited" : right ? "WNL" : "";
                          
                          return (
                            <span>
                              {leftStatus && <span className={leftStatus === "Limited" ? "text-red-600" : "text-green-600"}>Left: {leftStatus}</span>}
                              {leftStatus && rightStatus && " | "}
                              {rightStatus && <span className={rightStatus === "Limited" ? "text-red-600" : "text-green-600"}>Right: {rightStatus}</span>}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!selectedJoint}>
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}