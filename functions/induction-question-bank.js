"use strict";

module.exports = {
  categoryPlan: {
    fire: 2,
    emergency: 1,
    start_right: 1,
    rams_permits: 2,
    site_rules: 2,
    hot_works: 1,
    plant_flt: 2,
    lifting: 1,
    wah: 2,
    mewp: 2,
    live_services_isolation: 1,
    tools_electrical: 1,
    coshh_dust_noise: 1,
    asbestos: 1
  },

  questionSections: [
  {
    id: "fire",
    title: "Fire Safety",
    questions: [
      {
        id: "fire-001",
        category: "fire",
        question: "What should you do if you discover a fire or smoke on site?",
        options: [
          "Raise the alarm, move to a safe place and follow the site emergency procedure",
          "Try to finish the job quickly before leaving",
          "Wait to see if the fire gets worse",
          "Move tools and materials first before reporting it"
        ],
        correctAnswer: "Raise the alarm, move to a safe place and follow the site emergency procedure"
      },
      {
        id: "fire-002",
        category: "fire",
        question: "What does the continuous fire alarm mean?",
        options: [
          "Evacuate immediately using the nearest safe fire exit",
          "Stand by and continue working carefully",
          "Wait for your supervisor to collect you",
          "Go to the office to ask what is happening"
        ],
        correctAnswer: "Evacuate immediately using the nearest safe fire exit"
      },
      {
        id: "fire-003",
        category: "fire",
        question: "What should you do with tools and personal belongings during a fire evacuation?",
        options: [
          "Leave them and evacuate without delay",
          "Collect them if they are close by",
          "Only take expensive tools",
          "Move them to the side of the work area first"
        ],
        correctAnswer: "Leave them and evacuate without delay"
      },
      {
        id: "fire-004",
        category: "fire",
        question: "Who can authorise re-entry after a fire evacuation?",
        options: [
          "Business Protection or the authorised emergency team",
          "Any contractor supervisor",
          "The first person back at the work area",
          "Anyone wearing high visibility clothing"
        ],
        correctAnswer: "Business Protection or the authorised emergency team"
      },
      {
        id: "fire-005",
        category: "fire",
        question: "What must always be kept clear?",
        options: [
          "Fire exits, escape routes, call points and fire-fighting equipment",
          "Only the main entrance",
          "Only the welfare facilities",
          "Only your company’s own work area"
        ],
        correctAnswer: "Fire exits, escape routes, call points and fire-fighting equipment"
      },
      {
        id: "fire-006",
        category: "fire",
        question: "What should you do if a fire door or fire escape route is blocked?",
        options: [
          "Report it immediately and do not ignore the obstruction",
          "Leave it if people can still squeeze past",
          "Only report it at the end of the shift",
          "Move the obstruction into another route"
        ],
        correctAnswer: "Report it immediately and do not ignore the obstruction"
      }
    ]
  },

  {
    id: "emergency",
    title: "Emergency Arrangements",
    questions: [
      {
        id: "emergency-001",
        category: "emergency",
        question: "If the intermittent two-tone alarm sounds while you are working at height, what should you do?",
        options: [
          "Come down to ground level and prepare for further instruction",
          "Evacuate immediately every time",
          "Carry on because it is not a continuous alarm",
          "Wait at height until someone comes to you"
        ],
        correctAnswer: "Come down to ground level and prepare for further instruction"
      },
      {
        id: "emergency-002",
        category: "emergency",
        question: "What information should be given when reporting an emergency?",
        options: [
          "Who you are, where you are and what the concern is",
          "Only your company name",
          "Only the building name",
          "Only the name of your supervisor"
        ],
        correctAnswer: "Who you are, where you are and what the concern is"
      },
      {
        id: "emergency-003",
        category: "emergency",
        question: "When should accidents and near misses be reported?",
        options: [
          "As soon as practicable to QSC and your supervisor",
          "Only if someone goes to hospital",
          "Only at the end of the project",
          "Only if the client asks"
        ],
        correctAnswer: "As soon as practicable to QSC and your supervisor"
      },
      {
        id: "emergency-004",
        category: "emergency",
        question: "What should you do if you are unsure about an emergency instruction?",
        options: [
          "Stop and ask the site manager, supervisor or responsible site representative",
          "Guess based on what happened on another site",
          "Ignore it until there is an emergency",
          "Ask another new worker only"
        ],
        correctAnswer: "Stop and ask the site manager, supervisor or responsible site representative"
      }
    ]
  },

  {
    id: "start-right",
    title: "Start Right and Daily Briefing",
    questions: [
      {
        id: "start-right-001",
        category: "start_right",
        question: "What is the purpose of the Start Right meeting?",
        options: [
          "To plan, prioritise and understand the day’s work, hazards, people and permits",
          "Only to record who arrived first",
          "Only to discuss welfare facilities",
          "To replace the need for RAMS"
        ],
        correctAnswer: "To plan, prioritise and understand the day’s work, hazards, people and permits"
      },
      {
        id: "start-right-002",
        category: "start_right",
        question: "What should supervisors provide for the daily Start Right meeting?",
        options: [
          "Details of workers, activities, hazards, permits and any issues for that day",
          "Only the company name",
          "Only the number of vehicles on site",
          "Only a copy of yesterday’s briefing"
        ],
        correctAnswer: "Details of workers, activities, hazards, permits and any issues for that day"
      },
      {
        id: "start-right-003",
        category: "start_right",
        question: "When should the Daily SHE briefing be completed?",
        options: [
          "Daily, before work starts or before starting a late/night shift",
          "Only once at the start of the project",
          "Only after an accident",
          "Only when the client is visiting"
        ],
        correctAnswer: "Daily, before work starts or before starting a late/night shift"
      },
      {
        id: "start-right-004",
        category: "start_right",
        question: "What should happen if the task, area or equipment changes after the briefing?",
        options: [
          "Stop and confirm the new controls before continuing",
          "Carry on because the morning briefing was completed",
          "Only update the paperwork at the end of the shift",
          "Let another trade decide"
        ],
        correctAnswer: "Stop and confirm the new controls before continuing"
      }
    ]
  },

  {
    id: "rams-permits",
    title: "RAMS, CJR and Permits",
    questions: [
      {
        id: "rams-001",
        category: "rams_permits",
        question: "What must operatives do before starting work under their company RAMS?",
        options: [
          "Read and sign to confirm they understand the RAMS",
          "Only know where the RAMS are stored",
          "Let the supervisor sign for everyone",
          "Only read them if the job changes"
        ],
        correctAnswer: "Read and sign to confirm they understand the RAMS"
      },
      {
        id: "rams-002",
        category: "rams_permits",
        question: "What should you do if you are in doubt about the task or controls?",
        options: [
          "Stop work and ask before continuing",
          "Carry on slowly and ask later",
          "Ask another operative and continue",
          "Make the safest guess you can"
        ],
        correctAnswer: "Stop work and ask before continuing"
      },
      {
        id: "rams-003",
        category: "rams_permits",
        question: "What is a CJR / OCJR used for?",
        options: [
          "It confirms the contractor job registration and allows the work to be carried out on site",
          "It replaces RAMS",
          "It replaces all permits",
          "It is only used for parking"
        ],
        correctAnswer: "It confirms the contractor job registration and allows the work to be carried out on site"
      },
      {
        id: "rams-004",
        category: "rams_permits",
        question: "Who issues hot works permits on this type of site arrangement?",
        options: [
          "JLR Business Protection",
          "Any contractor supervisor",
          "The newest person on the job",
          "The person carrying out the hot works"
        ],
        correctAnswer: "JLR Business Protection"
      },
      {
        id: "rams-005",
        category: "rams_permits",
        question: "Who issues QSC work at height permits for MEWPs, ladders, stepladders and hop-ups?",
        options: [
          "QSC",
          "The worker using the equipment",
          "Security",
          "The canteen team"
        ],
        correctAnswer: "QSC"
      },
      {
        id: "rams-006",
        category: "rams_permits",
        question: "What should happen if RAMS or permits no longer match the work being done?",
        options: [
          "Stop, review the change and update the controls before continuing",
          "Carry on and fix the paperwork later",
          "Only tell someone if there is an accident",
          "Let the newest worker decide"
        ],
        correctAnswer: "Stop, review the change and update the controls before continuing"
      },
      {
        id: "rams-007",
        category: "rams_permits",
        question: "Is lone working permitted on site under this induction?",
        options: [
          "No, lone working is not permitted",
          "Yes, if the job is simple",
          "Yes, if the worker has a phone",
          "Only at weekends"
        ],
        correctAnswer: "No, lone working is not permitted"
      }
    ]
  },

  {
    id: "site-rules",
    title: "General Site Rules",
    questions: [
      {
        id: "site-rules-001",
        category: "site_rules",
        question: "What PPE must be worn as a minimum where required by the CDM area rules?",
        options: [
          "Hard hat, hi-vis clothing and safety footwear, plus any task-specific PPE",
          "Only safety boots",
          "Only gloves and glasses",
          "Only PPE that feels comfortable"
        ],
        correctAnswer: "Hard hat, hi-vis clothing and safety footwear, plus any task-specific PPE"
      },
      {
        id: "site-rules-002",
        category: "site_rules",
        question: "What should you do if your PPE is damaged or no longer suitable?",
        options: [
          "Replace it before continuing the task",
          "Use it until the end of the day",
          "Repair it with tape",
          "Share someone else’s PPE without checking it"
        ],
        correctAnswer: "Replace it before continuing the task"
      },
      {
        id: "site-rules-003",
        category: "site_rules",
        question: "What is the correct rule for smoking and vaping?",
        options: [
          "Only smoke or vape in designated smoking areas",
          "Smoke inside if doors are open",
          "Vape anywhere if no one complains",
          "Smoke in the work area during breaks"
        ],
        correctAnswer: "Only smoke or vape in designated smoking areas"
      },
      {
        id: "site-rules-004",
        category: "site_rules",
        question: "What is the correct approach to alcohol and drugs on site?",
        options: [
          "They are strictly forbidden and anyone under the influence must not work",
          "They are allowed if used before the shift",
          "They are allowed if the worker feels fine",
          "They only matter when operating plant"
        ],
        correctAnswer: "They are strictly forbidden and anyone under the influence must not work"
      },
      {
        id: "site-rules-005",
        category: "site_rules",
        question: "What should you do before using a mobile phone on site?",
        options: [
          "Stop in a safe place before making or taking the call",
          "Walk and talk if the route looks clear",
          "Use the phone while crossing work areas",
          "Use the phone while operating plant if you are careful"
        ],
        correctAnswer: "Stop in a safe place before making or taking the call"
      },
      {
        id: "site-rules-006",
        category: "site_rules",
        question: "What is the rule for photography on JLR sites under this induction?",
        options: [
          "No photography is allowed unless specifically authorised",
          "Photos are allowed for personal records",
          "Photos are allowed if no vehicles are visible",
          "Photos are allowed if taken quickly"
        ],
        correctAnswer: "No photography is allowed unless specifically authorised"
      },
      {
        id: "site-rules-007",
        category: "site_rules",
        question: "What should you do with welfare facilities?",
        options: [
          "Respect them, clear up after yourself and use the bins provided",
          "Leave personal items behind when finished",
          "Wear dirty overalls in rest areas",
          "Use any production boxes for storage"
        ],
        correctAnswer: "Respect them, clear up after yourself and use the bins provided"
      },
      {
        id: "site-rules-008",
        category: "site_rules",
        question: "What is the rule for food and drink in CDM areas?",
        options: [
          "No food or drink except bottled water",
          "Food is allowed if eaten quickly",
          "Hot drinks are allowed near the workface",
          "Food is allowed if wrapped"
        ],
        correctAnswer: "No food or drink except bottled water"
      },
      {
        id: "site-rules-009",
        category: "site_rules",
        question: "What should happen to work areas at the end of the shift?",
        options: [
          "They should be left clean, tidy and free from unnecessary hazards",
          "Waste can be left for the next shift",
          "Trailing leads can stay out if work continues tomorrow",
          "Only the main walkway needs clearing"
        ],
        correctAnswer: "They should be left clean, tidy and free from unnecessary hazards"
      }
    ]
  },
    {
    id: "hot-works",
    title: "Hot Works",
    questions: [
      {
        id: "hot-works-001",
        category: "hot_works",
        question: "What must be in place before hot works start?",
        options: [
          "A hot works permit, fire controls and the agreed fire watch where required",
          "Only a verbal agreement from the supervisor",
          "Only a fire extinguisher nearby",
          "Only a copy of the RAMS in the van"
        ],
        correctAnswer: "A hot works permit, fire controls and the agreed fire watch where required"
      },
      {
        id: "hot-works-002",
        category: "hot_works",
        question: "Who must be notified before hot works start?",
        options: [
          "QSC and the responsible site arrangements as required by the permit",
          "Only the person doing the welding or cutting",
          "Only the person watching the work",
          "Nobody if the hot work is only small"
        ],
        correctAnswer: "QSC and the responsible site arrangements as required by the permit"
      },
      {
        id: "hot-works-003",
        category: "hot_works",
        question: "What should be done with combustible materials before hot works start?",
        options: [
          "Clear them from the area or protect them using suitable controls",
          "Leave them if they are not directly under the work",
          "Cover them with cardboard",
          "Move them only after sparks are produced"
        ],
        correctAnswer: "Clear them from the area or protect them using suitable controls"
      },
      {
        id: "hot-works-004",
        category: "hot_works",
        question: "What must be available at the hot works location?",
        options: [
          "Suitable fire-fighting equipment and the hot works permit",
          "Only a bucket of water",
          "Only a first aid kit",
          "Only a mobile phone"
        ],
        correctAnswer: "Suitable fire-fighting equipment and the hot works permit"
      },
      {
        id: "hot-works-005",
        category: "hot_works",
        question: "Why is a fire watch required after hot works?",
        options: [
          "Because heat or sparks can start a fire after the work appears finished",
          "Only to help clean the work area",
          "Only so the permit has another signature",
          "Only if the work was done outside"
        ],
        correctAnswer: "Because heat or sparks can start a fire after the work appears finished"
      },
      {
        id: "hot-works-006",
        category: "hot_works",
        question: "What should you do if hot works conditions change?",
        options: [
          "Stop and get the permit and controls reviewed before continuing",
          "Carry on if the work is nearly finished",
          "Only tell someone after the permit expires",
          "Move to another area without telling anyone"
        ],
        correctAnswer: "Stop and get the permit and controls reviewed before continuing"
      }
    ]
  },

  {
    id: "plant-flt",
    title: "Plant and FLT",
    questions: [
      {
        id: "plant-flt-001",
        category: "plant_flt",
        question: "What must be completed before using mobile plant or an FLT?",
        options: [
          "Pre-use checks and confirmation the operator is authorised and competent",
          "Only checking the horn",
          "Only checking the fuel or battery level",
          "Nothing if the plant was used yesterday"
        ],
        correctAnswer: "Pre-use checks and confirmation the operator is authorised and competent"
      },
      {
        id: "plant-flt-002",
        category: "plant_flt",
        question: "What must be available for plant and lifting equipment where required?",
        options: [
          "In-date inspection records or LOLER certification",
          "Only the machine keys",
          "Only the operator’s opinion",
          "Only a photo of the machine"
        ],
        correctAnswer: "In-date inspection records or LOLER certification"
      },
      {
        id: "plant-flt-003",
        category: "plant_flt",
        question: "What should happen if a defect is found on plant or an FLT?",
        options: [
          "Take it out of use and report the defect",
          "Use it for one more job only",
          "Use it if the defect looks minor",
          "Only write it down at the end of the week"
        ],
        correctAnswer: "Take it out of use and report the defect"
      },
      {
        id: "plant-flt-004",
        category: "plant_flt",
        question: "When is a banksman or spotter required for an FLT?",
        options: [
          "When required by the task, route, visibility, area or load conditions",
          "Only outdoors",
          "Only when the driver is new",
          "Never if the FLT has a beacon"
        ],
        correctAnswer: "When required by the task, route, visibility, area or load conditions"
      },
      {
        id: "plant-flt-005",
        category: "plant_flt",
        question: "Where should the banksman or spotter position themselves?",
        options: [
          "In a safe position where they remain visible to the driver",
          "Close enough to touch the load",
          "Behind the FLT whenever possible",
          "Wherever they can shout the loudest"
        ],
        correctAnswer: "In a safe position where they remain visible to the driver"
      },
      {
        id: "plant-flt-006",
        category: "plant_flt",
        question: "What should pedestrians do around moving plant?",
        options: [
          "Stay out of exclusion zones and make sure the operator has seen them where needed",
          "Walk behind the plant because it is quicker",
          "Assume the operator will always stop",
          "Stand close to guide the load without permission"
        ],
        correctAnswer: "Stay out of exclusion zones and make sure the operator has seen them where needed"
      },
      {
        id: "plant-flt-007",
        category: "plant_flt",
        question: "What should happen to plant when it is not in use or at the end of the shift?",
        options: [
          "It should be parked safely in the agreed area and left secure",
          "It can be left anywhere if the job continues tomorrow",
          "Keys can be left in the machine for the next operator",
          "It should be parked in front of the nearest access door"
        ],
        correctAnswer: "It should be parked safely in the agreed area and left secure"
      }
    ]
  },

  {
    id: "lifting",
    title: "Lifting Operations",
    questions: [
      {
        id: "lifting-001",
        category: "lifting",
        question: "What must be in place before a lifting operation starts?",
        options: [
          "A suitable lifting plan, competent people and inspected lifting equipment",
          "Only a strong-looking chain",
          "Only enough space to move the load",
          "Only someone standing nearby to watch"
        ],
        correctAnswer: "A suitable lifting plan, competent people and inspected lifting equipment"
      },
      {
        id: "lifting-002",
        category: "lifting",
        question: "Who should plan lifting operations?",
        options: [
          "A competent person managing the lift",
          "The newest worker on the team",
          "Anyone available at the time",
          "The person nearest to the load"
        ],
        correctAnswer: "A competent person managing the lift"
      },
      {
        id: "lifting-003",
        category: "lifting",
        question: "What should be checked before using slings, chains, shackles or lifting accessories?",
        options: [
          "Condition, identification and current inspection where required",
          "Only that they are nearby",
          "Only that they look heavy-duty",
          "Only that they were used before"
        ],
        correctAnswer: "Condition, identification and current inspection where required"
      },
      {
        id: "lifting-004",
        category: "lifting",
        question: "What should you do if a load appears unstable or not secure?",
        options: [
          "Stop the lift and make it safe before continuing",
          "Lift it slowly and see what happens",
          "Stand closer and hold it steady",
          "Ask someone to push it while lifting"
        ],
        correctAnswer: "Stop the lift and make it safe before continuing"
      },
      {
        id: "lifting-005",
        category: "lifting",
        question: "Where should people stand during lifting operations?",
        options: [
          "Outside the exclusion zone and away from suspended loads",
          "Under the load if wearing a hard hat",
          "Beside the load to guide it by hand whenever possible",
          "Wherever gives the best view"
        ],
        correctAnswer: "Outside the exclusion zone and away from suspended loads"
      }
    ]
  },

  {
    id: "wah",
    title: "Work at Height",
    questions: [
      {
        id: "wah-001",
        category: "wah",
        question: "What must be in place before work at height starts?",
        options: [
          "A suitable plan, QSC permit where required, safe access and rescue arrangements",
          "Only a ladder nearby",
          "Only a harness in the van",
          "Only someone watching from the ground"
        ],
        correctAnswer: "A suitable plan, QSC permit where required, safe access and rescue arrangements"
      },
      {
        id: "wah-002",
        category: "wah",
        question: "What is the preferred approach to work at height where reasonably practicable?",
        options: [
          "Carry out the work from ground level where possible",
          "Use a ladder first because it is quick",
          "Use a MEWP for every job",
          "Stand on nearby equipment if it saves time"
        ],
        correctAnswer: "Carry out the work from ground level where possible"
      },
      {
        id: "wah-003",
        category: "wah",
        question: "What must work at height risk assessments include?",
        options: [
          "An emergency rescue plan and controls to prevent falls",
          "Only the names of the workers",
          "Only the start and finish time",
          "Only the list of tools"
        ],
        correctAnswer: "An emergency rescue plan and controls to prevent falls"
      },
      {
        id: "wah-004",
        category: "wah",
        question: "What must be done with tools when working at height?",
        options: [
          "They must be tethered where required to prevent dropped objects",
          "They can be placed loose on the platform edge",
          "They can be passed by throwing them carefully",
          "They only need controlling if they are heavy"
        ],
        correctAnswer: "They must be tethered where required to prevent dropped objects"
      },
      {
        id: "wah-005",
        category: "wah",
        question: "What should you do if edge protection, barriers or fall controls are missing?",
        options: [
          "Stop and report it before anyone continues near the fall risk",
          "Work carefully around the gap",
          "Put a cone nearby and carry on",
          "Only report it after the task is finished"
        ],
        correctAnswer: "Stop and report it before anyone continues near the fall risk"
      },
      {
        id: "wah-006",
        category: "wah",
        question: "What should happen if the work at height method changes?",
        options: [
          "Stop and review the RAMS, permit and controls before continuing",
          "Carry on if the task is nearly finished",
          "Only tell someone at the end of the shift",
          "Let the MEWP operator decide alone"
        ],
        correctAnswer: "Stop and review the RAMS, permit and controls before continuing"
      },
      {
        id: "wah-007",
        category: "wah",
        question: "What should you do if you feel unsafe while working at height?",
        options: [
          "Stop work and raise the concern immediately",
          "Rush the job to finish quicker",
          "Ignore it if others are working",
          "Keep going until break time"
        ],
        correctAnswer: "Stop work and raise the concern immediately"
      }
    ]
  },

  {
    id: "ladders",
    title: "Ladders and Stepladders",
    questions: [
      {
        id: "ladder-001",
        category: "wah",
        question: "What should be checked before using a ladder or stepladder?",
        options: [
          "It is suitable, undamaged, inspected and positioned safely",
          "Only that it is the nearest ladder",
          "Only that someone used it yesterday",
          "Only that it is long enough"
        ],
        correctAnswer: "It is suitable, undamaged, inspected and positioned safely"
      },
      {
        id: "ladder-002",
        category: "wah",
        question: "How should ladders be controlled where required?",
        options: [
          "They should be secured or footed where needed",
          "They can be leaned up without checking",
          "They only need holding if they wobble badly",
          "They can be used side-on to the task"
        ],
        correctAnswer: "They should be secured or footed where needed"
      },
      {
        id: "ladder-003",
        category: "wah",
        question: "What should you maintain when using a ladder?",
        options: [
          "Three points of contact where practicable",
          "One hand free for carrying materials",
          "Both hands full if the job is quick",
          "No contact if someone is footing the ladder"
        ],
        correctAnswer: "Three points of contact where practicable"
      },
      {
        id: "ladder-004",
        category: "wah",
        question: "What is the rule for the top rungs or top steps?",
        options: [
          "Do not use the top three rungs of a ladder or the top three steps of a stepladder",
          "Use them if you can balance",
          "Use them if the task only takes a minute",
          "Use them when someone is watching"
        ],
        correctAnswer: "Do not use the top three rungs of a ladder or the top three steps of a stepladder"
      }
    ]
  },

  {
    id: "mewp",
    title: "MEWP and Harness",
    questions: [
      {
        id: "mewp-001",
        category: "mewp",
        question: "What must be worn and connected when working in a MEWP?",
        options: [
          "Harness with a work-restraint lanyard clipped to the MEWP anchor point",
          "Harness only if working outside",
          "Harness only when fully elevated",
          "Harness carried in the basket but not clipped"
        ],
        correctAnswer: "Harness with a work-restraint lanyard clipped to the MEWP anchor point"
      },
      {
        id: "mewp-002",
        category: "mewp",
        question: "What must be completed before using a MEWP?",
        options: [
          "Daily pre-start checks and confirmation the operator is competent and authorised",
          "Only a quick look from the ground",
          "Only checking that the basket goes up",
          "Nothing if another trade used it earlier"
        ],
        correctAnswer: "Daily pre-start checks and confirmation the operator is competent and authorised"
      },
      {
        id: "mewp-003",
        category: "mewp",
        question: "What should happen if a MEWP fault is found during the pre-use check?",
        options: [
          "Do not use it and report the defect",
          "Use it only at low level",
          "Use it if it still moves",
          "Put tape on it and carry on"
        ],
        correctAnswer: "Do not use it and report the defect"
      },
      {
        id: "mewp-004",
        category: "mewp",
        question: "What is required when a MEWP is operating on site?",
        options: [
          "A banksman where required by the site arrangement and task controls",
          "No banksman if the operator is experienced",
          "Only a banksman outdoors",
          "Only another person in the basket"
        ],
        correctAnswer: "A banksman where required by the site arrangement and task controls"
      },
      {
        id: "mewp-005",
        category: "mewp",
        question: "Why is a MEWP rescue plan needed?",
        options: [
          "So a person can be recovered safely if the platform cannot be lowered normally",
          "Only to satisfy paperwork",
          "Only because the client might ask",
          "Only for roof work"
        ],
        correctAnswer: "So a person can be recovered safely if the platform cannot be lowered normally"
      },
      {
        id: "mewp-006",
        category: "mewp",
        question: "What should you do after dismounting from a MEWP?",
        options: [
          "Detach your lanyard from the anchor point as soon as it is safe to do so",
          "Leave the lanyard clipped while walking away",
          "Wrap the lanyard around the handrail",
          "Give the lanyard to another operative"
        ],
        correctAnswer: "Detach your lanyard from the anchor point as soon as it is safe to do so"
      },
      {
        id: "mewp-007",
        category: "mewp",
        question: "What must be considered when moving or operating a MEWP near people or vehicles?",
        options: [
          "Segregation, exclusion zones and safe movement of the machine",
          "Only how quickly the job can be finished",
          "Only where the charger is",
          "Only the colour of the machine"
        ],
        correctAnswer: "Segregation, exclusion zones and safe movement of the machine"
      }
    ]
  },
    {
    id: "live-services-isolation",
    title: "Live Services and Isolation",
    questions: [
      {
        id: "live-services-001",
        category: "live_services_isolation",
        question: "What must you confirm before removing equipment, pipework, cabling or services?",
        options: [
          "That services have been isolated or made safe with documented confirmation",
          "That the equipment looks old",
          "That another contractor said it should be safe",
          "That the task will only take a few minutes"
        ],
        correctAnswer: "That services have been isolated or made safe with documented confirmation"
      },
      {
        id: "live-services-002",
        category: "live_services_isolation",
        question: "What should you do if you are unsure whether a service is live?",
        options: [
          "Stop work and contact QSC or the responsible site representative",
          "Cut it carefully and see what happens",
          "Ask another operative to try first",
          "Carry on if the cable or pipe looks redundant"
        ],
        correctAnswer: "Stop work and contact QSC or the responsible site representative"
      },
      {
        id: "live-services-003",
        category: "live_services_isolation",
        question: "Who can remove lock-off controls or padlocks?",
        options: [
          "Only authorised persons following the agreed isolation procedure",
          "Anyone who needs the power back on",
          "The nearest supervisor",
          "Anyone with bolt cutters"
        ],
        correctAnswer: "Only authorised persons following the agreed isolation procedure"
      },
      {
        id: "live-services-004",
        category: "live_services_isolation",
        question: "What should you do if you find exposed, damaged or unprotected services?",
        options: [
          "Keep clear, prevent others approaching and report it immediately",
          "Move it by hand if it is in the way",
          "Cover it with tape and carry on",
          "Only report it at the end of the day"
        ],
        correctAnswer: "Keep clear, prevent others approaching and report it immediately"
      }
    ]
  },

  {
    id: "tools-electrical",
    title: "Tools and Electrical Safety",
    questions: [
      {
        id: "tools-electrical-001",
        category: "tools_electrical",
        question: "What should you do before using tools or equipment?",
        options: [
          "Check they are suitable, in good condition and used as intended",
          "Use whichever tool is closest",
          "Use damaged tools if the job is quick",
          "Borrow tools without checking them"
        ],
        correctAnswer: "Check they are suitable, in good condition and used as intended"
      },
      {
        id: "tools-electrical-002",
        category: "tools_electrical",
        question: "What should happen if a tool guard is missing or damaged?",
        options: [
          "Do not use the tool and report it",
          "Use it carefully for a short task",
          "Ask someone to hold the guard in place",
          "Only report it if the tool stops working"
        ],
        correctAnswer: "Do not use the tool and report it"
      },
      {
        id: "tools-electrical-003",
        category: "tools_electrical",
        question: "What voltage should be used for portable electrical tools where possible under this induction?",
        options: [
          "The lowest voltage possible, 110v maximum",
          "240v wherever available",
          "Any voltage if the tool works",
          "Only battery tools are allowed"
        ],
        correctAnswer: "The lowest voltage possible, 110v maximum"
      },
      {
        id: "tools-electrical-004",
        category: "tools_electrical",
        question: "What should portable electrical tools have?",
        options: [
          "Up-to-date test certification or inspection evidence as required",
          "Only a company logo",
          "Only a clean cable",
          "Only proof they were used before"
        ],
        correctAnswer: "Up-to-date test certification or inspection evidence as required"
      },
      {
        id: "tools-electrical-005",
        category: "tools_electrical",
        question: "Can contractors plug equipment into production sockets without permission?",
        options: [
          "No, permission must be obtained before using production sockets",
          "Yes, if the socket is close to the work",
          "Yes, if the plug fits",
          "Only if the task is short"
        ],
        correctAnswer: "No, permission must be obtained before using production sockets"
      },
      {
        id: "tools-electrical-006",
        category: "tools_electrical",
        question: "Who is allowed to mount, change or dress an abrasive wheel or disc?",
        options: [
          "Only someone trained, competent and authorised",
          "Anyone who has used a grinder before",
          "Any supervisor",
          "Anyone wearing gloves"
        ],
        correctAnswer: "Only someone trained, competent and authorised"
      },
      {
        id: "tools-electrical-007",
        category: "tools_electrical",
        question: "What must be in place before using a grinder?",
        options: [
          "The guard and handle must be fitted and the wheel must be in good condition",
          "Only the correct extension lead",
          "Only a nearby fire extinguisher",
          "Only someone watching the work"
        ],
        correctAnswer: "The guard and handle must be fitted and the wheel must be in good condition"
      }
    ]
  },

  {
    id: "coshh-dust-noise",
    title: "COSHH, Dust and Noise",
    questions: [
      {
        id: "coshh-001",
        category: "coshh_dust_noise",
        question: "What must be available for hazardous substances used on site?",
        options: [
          "A COSHH assessment and safety data information where required",
          "Only the product name",
          "Only the container colour",
          "Only verbal instructions"
        ],
        correctAnswer: "A COSHH assessment and safety data information where required"
      },
      {
        id: "coshh-002",
        category: "coshh_dust_noise",
        question: "How should materials and substances be stored?",
        options: [
          "In suitable containers, correctly labelled and bunded where required",
          "In any spare container",
          "Beside drains for easy cleaning",
          "Unlabelled if everyone knows what they are"
        ],
        correctAnswer: "In suitable containers, correctly labelled and bunded where required"
      },
      {
        id: "coshh-003",
        category: "coshh_dust_noise",
        question: "What controls should be used where dust is created by the task?",
        options: [
          "Suitable controls such as extraction, damping down and correct RPE where required",
          "Sweep it up at the end only",
          "Blow it away with compressed air",
          "Ignore it if the task is short"
        ],
        correctAnswer: "Suitable controls such as extraction, damping down and correct RPE where required"
      },
      {
        id: "coshh-004",
        category: "coshh_dust_noise",
        question: "When must hearing protection be worn?",
        options: [
          "When required by the task, area or noise level",
          "Only when someone complains",
          "Only outdoors",
          "Only after your ears start ringing"
        ],
        correctAnswer: "When required by the task, area or noise level"
      },
      {
        id: "coshh-005",
        category: "coshh_dust_noise",
        question: "Are earphones allowed in QSC managed CDM areas?",
        options: [
          "No, earphones are not to be worn",
          "Yes, if only one earphone is used",
          "Yes, if the music is quiet",
          "Yes, during low-risk work"
        ],
        correctAnswer: "No, earphones are not to be worn"
      },
      {
        id: "coshh-006",
        category: "coshh_dust_noise",
        question: "What is required for welding operations under this induction?",
        options: [
          "LEV and suitable RPE where required, no LEV means no welding",
          "Only a fire extinguisher",
          "Only safety glasses",
          "Only opening a nearby door"
        ],
        correctAnswer: "LEV and suitable RPE where required, no LEV means no welding"
      }
    ]
  },

  {
    id: "asbestos",
    title: "Asbestos",
    questions: [
      {
        id: "asbestos-001",
        category: "asbestos",
        question: "Where is asbestos information normally identified?",
        options: [
          "By ACM labels or in the site asbestos register",
          "Only by asking other contractors",
          "Only by looking at the colour of the material",
          "Only after work has started"
        ],
        correctAnswer: "By ACM labels or in the site asbestos register"
      },
      {
        id: "asbestos-002",
        category: "asbestos",
        question: "What should you do before disturbing building fabric or unknown materials?",
        options: [
          "Confirm asbestos information and get permission before starting",
          "Assume it is safe if it looks modern",
          "Drill a small hole to check",
          "Carry on if the material is painted"
        ],
        correctAnswer: "Confirm asbestos information and get permission before starting"
      },
      {
        id: "asbestos-003",
        category: "asbestos",
        question: "What should you do if you suspect asbestos during work?",
        options: [
          "Stop work, keep people away and report it immediately",
          "Bag it and remove it yourself",
          "Spray it with water and continue",
          "Only tell someone at the end of the day"
        ],
        correctAnswer: "Stop work, keep people away and report it immediately"
      },
      {
        id: "asbestos-004",
        category: "asbestos",
        question: "What should you do if you see damaged ACM?",
        options: [
          "Report it immediately",
          "Move it out of the way",
          "Cover it with tape",
          "Ignore it if it is outside your work area"
        ],
        correctAnswer: "Report it immediately"
      }
    ]
  },

  {
    id: "environment-housekeeping",
    title: "Environment and Housekeeping",
    questions: [
      {
        id: "environment-001",
        category: "site_rules",
        question: "What should you do with trailing leads across walkways or work areas?",
        options: [
          "Manage them safely to prevent trip hazards",
          "Leave them if people can step over them",
          "Only move them at the end of the shift",
          "Cover them with loose cardboard"
        ],
        correctAnswer: "Manage them safely to prevent trip hazards"
      },
      {
        id: "environment-002",
        category: "site_rules",
        question: "What is the correct approach to holes in floors or damaged floor areas?",
        options: [
          "Secure, protect or report them so they do not create a hazard",
          "Leave them if they are small",
          "Cover them with loose material",
          "Only report them if someone trips"
        ],
        correctAnswer: "Secure, protect or report them so they do not create a hazard"
      },
      {
        id: "environment-003",
        category: "site_rules",
        question: "What should happen to contractor waste?",
        options: [
          "It should be removed or segregated in the correct waste location",
          "It can be placed in any production bin",
          "It can be left for another trade",
          "It should be hidden behind materials"
        ],
        correctAnswer: "It should be removed or segregated in the correct waste location"
      },
      {
        id: "environment-004",
        category: "site_rules",
        question: "Can waste, oils or solvents be disposed of down drains, manholes or grids?",
        options: [
          "No, never dispose of anything down drains, manholes or grids",
          "Yes, if diluted with water",
          "Yes, if it is only a small amount",
          "Only at the end of the shift"
        ],
        correctAnswer: "No, never dispose of anything down drains, manholes or grids"
      },
      {
        id: "environment-005",
        category: "site_rules",
        question: "What must contractors have available for spills where their work could create a spill risk?",
        options: [
          "Suitable spill kits",
          "Only paper towels",
          "Only a mop bucket",
          "Only warning signs"
        ],
        correctAnswer: "Suitable spill kits"
      },
      {
        id: "environment-006",
        category: "site_rules",
        question: "What should you do after a large spill?",
        options: [
          "Notify QSC immediately so the correct escalation can be made",
          "Wash it into the nearest drain",
          "Cover it and leave it for the next shift",
          "Only report it if it leaves the work area"
        ],
        correctAnswer: "Notify QSC immediately so the correct escalation can be made"
      }
    ]
  },

  {
    id: "production-vehicles",
    title: "Production Vehicles and Property Protection",
    questions: [
      {
        id: "production-001",
        category: "site_rules",
        question: "What should you do when working near production vehicles or parts?",
        options: [
          "Take precautions to prevent damage and report any damage immediately",
          "Ignore minor contact if no mark is visible",
          "Place tools on vehicles if protected by gloves",
          "Only report damage if the client sees it"
        ],
        correctAnswer: "Take precautions to prevent damage and report any damage immediately"
      },
      {
        id: "production-002",
        category: "site_rules",
        question: "What should be done with watches, rings, jewellery or sharp objects near production vehicles?",
        options: [
          "Remove or cover them to prevent damage",
          "Leave them on if working carefully",
          "Only remove them when entering offices",
          "Cover them with high-vis clothing"
        ],
        correctAnswer: "Remove or cover them to prevent damage"
      },
      {
        id: "production-003",
        category: "site_rules",
        question: "Why must tools be secured near production vehicles or when working above others?",
        options: [
          "To prevent dropped objects, injury and damage",
          "Only to stop tools being stolen",
          "Only to keep the work area looking tidy",
          "Only because tools are expensive"
        ],
        correctAnswer: "To prevent dropped objects, injury and damage"
      }
    ]
  }
  ]
};
