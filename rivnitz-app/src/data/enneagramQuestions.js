/**
 * Enneagram Tri-Type Assessment Questions
 *
 * Each question targets one of three centers: head, heart, or gut.
 * Each option maps to a specific type within that center.
 *
 * Head center: 5 (Observer), 6 (Loyalist), 6cp (Counter-phobic), 7 (Enthusiast)
 * Heart center: 2 (Helper), 3 (Achiever), 4 (Individualist)
 * Gut center: 1 (Reformer), 8 (Challenger), 9 (Peacemaker)
 */

export const ENNEAGRAM_QUESTIONS = {
  head: [
    {
      id: 'h1',
      question: 'When you face an uncertain situation, your first instinct is to:',
      options: [
        { text: 'Research and gather as much information as possible before acting', type: 5 },
        { text: 'Look for someone trustworthy to get advice or reassurance from', type: 6 },
        { text: 'Dive straight in — you prefer to confront the unknown head-on', type: '6cp' },
        { text: 'Focus on the exciting possibilities and stay optimistic', type: 7 },
      ],
    },
    {
      id: 'h2',
      question: 'In a group conversation, you are most likely to:',
      options: [
        { text: 'Listen carefully and speak only when you have something well-thought-out to say', type: 5 },
        { text: 'Check in with the group — you want to make sure everyone agrees', type: 6 },
        { text: 'Challenge ideas that seem weak or dishonest', type: '6cp' },
        { text: 'Keep the energy up — share stories, make jokes, suggest new ideas', type: 7 },
      ],
    },
    {
      id: 'h3',
      question: 'When plans suddenly change, you typically:',
      options: [
        { text: 'Withdraw to think through the new situation on your own', type: 5 },
        { text: 'Feel anxious and try to find a backup plan immediately', type: 6 },
        { text: 'Get frustrated but push through — you adapt by taking charge', type: '6cp' },
        { text: 'Get excited — change often brings better opportunities', type: 7 },
      ],
    },
    {
      id: 'h4',
      question: 'What drains your energy the most?',
      options: [
        { text: 'Being around too many people for too long without quiet time', type: 5 },
        { text: 'Not knowing what to expect or who you can trust', type: 6 },
        { text: 'Feeling like people around you are being passive or weak', type: '6cp' },
        { text: 'Being stuck in routine with nothing new or stimulating', type: 7 },
      ],
    },
    {
      id: 'h5',
      question: 'When someone disagrees with you, you tend to:',
      options: [
        { text: 'Take time to analyze their point of view objectively before responding', type: 5 },
        { text: 'Wonder if you might be wrong and seek more opinions', type: 6 },
        { text: 'Stand your ground firmly — if you know you are right, you say so', type: '6cp' },
        { text: 'Try to reframe the disagreement into something more positive', type: 7 },
      ],
    },
    {
      id: 'h6',
      question: 'Your ideal weekend would involve:',
      options: [
        { text: 'Deep reading, studying, or working on a personal project alone', type: 5 },
        { text: 'Spending time with close friends or family in a familiar, comfortable setting', type: 6 },
        { text: 'Doing something physically challenging or competitive', type: '6cp' },
        { text: 'Exploring somewhere new — a trip, event, or new experience', type: 7 },
      ],
    },
  ],
  heart: [
    {
      id: 'ht1',
      question: 'When a friend is going through a hard time, you instinctively:',
      options: [
        { text: 'Drop everything to help — you want to be there for them personally', type: 2 },
        { text: 'Think about the most effective way to help them move forward', type: 3 },
        { text: 'Feel their pain deeply and try to connect with them on an emotional level', type: 4 },
      ],
    },
    {
      id: 'ht2',
      question: 'What makes you feel most fulfilled?',
      options: [
        { text: 'Knowing that someone truly needs you and appreciates your care', type: 2 },
        { text: 'Achieving a goal and being recognized for your accomplishments', type: 3 },
        { text: 'Expressing something authentically that resonates with who you truly are', type: 4 },
      ],
    },
    {
      id: 'ht3',
      question: 'When you look at successful people, you most often think:',
      options: [
        { text: '"I wonder if they have people who truly care about them"', type: 2 },
        { text: '"I want to learn their strategies and achieve that level of success"', type: 3 },
        { text: '"Success means nothing if they have lost touch with their authentic self"', type: 4 },
      ],
    },
    {
      id: 'ht4',
      question: 'In relationships, your biggest fear is:',
      options: [
        { text: 'Being unwanted or unneeded', type: 2 },
        { text: 'Being seen as a failure or not impressive enough', type: 3 },
        { text: 'Being ordinary — losing what makes you unique', type: 4 },
      ],
    },
    {
      id: 'ht5',
      question: 'When you receive criticism, your first reaction is:',
      options: [
        { text: '"Did I not do enough? I should have been more helpful"', type: 2 },
        { text: '"How can I improve? I need to adjust my approach"', type: 3 },
        { text: '"They don\'t understand me. No one really gets who I am"', type: 4 },
      ],
    },
    {
      id: 'ht6',
      question: 'What describes you best at work or in projects?',
      options: [
        { text: 'The one everyone comes to for help and emotional support', type: 2 },
        { text: 'The one who drives results and gets things done efficiently', type: 3 },
        { text: 'The one with unique creative ideas that others overlook', type: 4 },
      ],
    },
  ],
  gut: [
    {
      id: 'g1',
      question: 'When you see something being done incorrectly, you:',
      options: [
        { text: 'Feel compelled to fix it — there is a right way to do things', type: 1 },
        { text: 'Take over and handle it yourself — sometimes you just have to lead', type: 8 },
        { text: 'Let it go — it is not worth the conflict, things will work out', type: 9 },
      ],
    },
    {
      id: 'g2',
      question: 'How do you handle anger?',
      options: [
        { text: 'You try to control it — getting angry feels wrong, so you hold it in', type: 1 },
        { text: 'You express it directly — people know when you are upset', type: 8 },
        { text: 'You avoid it — anger is uncomfortable and you prefer peace', type: 9 },
      ],
    },
    {
      id: 'g3',
      question: 'In a team decision, you prefer to:',
      options: [
        { text: 'Make sure the decision is fair, principled, and well-reasoned', type: 1 },
        { text: 'Take charge and push for the strongest option', type: 8 },
        { text: 'Go along with what the group wants — harmony matters most', type: 9 },
      ],
    },
    {
      id: 'g4',
      question: 'What bothers you most about other people?',
      options: [
        { text: 'Laziness, sloppiness, or not caring about doing things properly', type: 1 },
        { text: 'Weakness, dishonesty, or people who refuse to stand up for themselves', type: 8 },
        { text: 'Conflict, aggression, or people who disrupt the peace', type: 9 },
      ],
    },
    {
      id: 'g5',
      question: 'When under stress, you tend to:',
      options: [
        { text: 'Become more critical of yourself and others', type: 1 },
        { text: 'Become more confrontational and controlling', type: 8 },
        { text: 'Shut down, withdraw, and numb out', type: 9 },
      ],
    },
    {
      id: 'g6',
      question: 'Your approach to rules and authority is:',
      options: [
        { text: 'Rules exist for a reason — you follow them and expect others to as well', type: 1 },
        { text: 'You respect strong leaders but will push back against unfair authority', type: 8 },
        { text: 'You prefer to keep the peace — you will bend to avoid confrontation', type: 9 },
      ],
    },
  ],
};

/**
 * Score enneagram answers.
 * @param {Object} answers - { head: [{questionId, selectedType},...], heart: [...], gut: [...] }
 * @returns {{ headType: number|string, heartType: number, gutType: number }}
 */
export function scoreEnneagram(answers) {
  const score = (centerAnswers) => {
    const counts = {};
    for (const answer of centerAnswers) {
      const type = String(answer.selectedType);
      counts[type] = (counts[type] || 0) + 1;
    }
    // Return the type with the highest count
    let maxType = null;
    let maxCount = 0;
    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxType = type;
      }
    }
    return maxType;
  };

  return {
    headType: score(answers.head),
    heartType: Number(score(answers.heart)),
    gutType: Number(score(answers.gut)),
  };
}

export default ENNEAGRAM_QUESTIONS;
