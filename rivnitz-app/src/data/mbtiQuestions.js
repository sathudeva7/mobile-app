/**
 * MBTI Assessment Questions
 *
 * 16 questions — 4 per dimension:
 * E/I (Extraversion/Introversion)
 * S/N (Sensing/Intuition)
 * T/F (Thinking/Feeling)
 * J/P (Judging/Perceiving)
 */

export const MBTI_QUESTIONS = [
  // E/I
  {
    id: 'ei1', dimension: 'EI',
    question: 'After a long day, you recharge by:',
    options: [
      { text: 'Going out with friends or being around people', pole: 'E' },
      { text: 'Spending quiet time alone or with one close person', pole: 'I' },
    ],
  },
  {
    id: 'ei2', dimension: 'EI',
    question: 'When solving a problem, you prefer to:',
    options: [
      { text: 'Talk it through with others — brainstorming energizes you', pole: 'E' },
      { text: 'Think it through internally first before discussing', pole: 'I' },
    ],
  },
  {
    id: 'ei3', dimension: 'EI',
    question: 'At social events, you usually:',
    options: [
      { text: 'Enjoy meeting new people and joining conversations', pole: 'E' },
      { text: 'Stick to people you know or find a quiet corner', pole: 'I' },
    ],
  },
  {
    id: 'ei4', dimension: 'EI',
    question: 'You feel most like yourself when you are:',
    options: [
      { text: 'Actively engaged with the world around you', pole: 'E' },
      { text: 'Reflecting on your inner thoughts and feelings', pole: 'I' },
    ],
  },
  // S/N
  {
    id: 'sn1', dimension: 'SN',
    question: 'When learning something new, you prefer:',
    options: [
      { text: 'Step-by-step instructions with concrete examples', pole: 'S' },
      { text: 'Understanding the big picture and underlying concepts first', pole: 'N' },
    ],
  },
  {
    id: 'sn2', dimension: 'SN',
    question: 'You trust more:',
    options: [
      { text: 'What you can see, touch, and verify with facts', pole: 'S' },
      { text: 'Your gut instincts and hunches about hidden meanings', pole: 'N' },
    ],
  },
  {
    id: 'sn3', dimension: 'SN',
    question: 'When describing an experience, you tend to focus on:',
    options: [
      { text: 'Specific details — what happened, who was there, what was said', pole: 'S' },
      { text: 'The overall meaning — what it felt like and what it symbolized', pole: 'N' },
    ],
  },
  {
    id: 'sn4', dimension: 'SN',
    question: 'You are more drawn to:',
    options: [
      { text: 'Practical, proven methods that work reliably', pole: 'S' },
      { text: 'Creative, innovative approaches even if untested', pole: 'N' },
    ],
  },
  // T/F
  {
    id: 'tf1', dimension: 'TF',
    question: 'When making an important decision, you rely more on:',
    options: [
      { text: 'Logic, analysis, and objective pros and cons', pole: 'T' },
      { text: 'How it affects people and what feels right in your heart', pole: 'F' },
    ],
  },
  {
    id: 'tf2', dimension: 'TF',
    question: 'When giving feedback, you value:',
    options: [
      { text: 'Being honest and direct, even if it is uncomfortable', pole: 'T' },
      { text: 'Being kind and encouraging, even if you soften the truth', pole: 'F' },
    ],
  },
  {
    id: 'tf3', dimension: 'TF',
    question: 'In an argument, you care most about:',
    options: [
      { text: 'Who is logically correct and what the facts show', pole: 'T' },
      { text: 'How everyone involved feels and maintaining the relationship', pole: 'F' },
    ],
  },
  {
    id: 'tf4', dimension: 'TF',
    question: 'People come to you more often for:',
    options: [
      { text: 'Clear-headed advice and practical solutions', pole: 'T' },
      { text: 'Emotional support and understanding', pole: 'F' },
    ],
  },
  // J/P
  {
    id: 'jp1', dimension: 'JP',
    question: 'Your workspace and daily life tend to be:',
    options: [
      { text: 'Organized — you like plans, lists, and having things settled', pole: 'J' },
      { text: 'Flexible — you keep options open and adapt as things come', pole: 'P' },
    ],
  },
  {
    id: 'jp2', dimension: 'JP',
    question: 'When starting a project, you prefer to:',
    options: [
      { text: 'Plan everything out before beginning', pole: 'J' },
      { text: 'Jump in and figure it out as you go', pole: 'P' },
    ],
  },
  {
    id: 'jp3', dimension: 'JP',
    question: 'Deadlines make you feel:',
    options: [
      { text: 'Motivated — you work best with clear timelines', pole: 'J' },
      { text: 'Pressured — you prefer working at your own pace', pole: 'P' },
    ],
  },
  {
    id: 'jp4', dimension: 'JP',
    question: 'On vacation, you prefer:',
    options: [
      { text: 'A planned itinerary so you make the most of it', pole: 'J' },
      { text: 'Going with the flow and discovering things spontaneously', pole: 'P' },
    ],
  },
];

/**
 * Score MBTI answers.
 * @param {Array} answers - [{questionId, selectedPole, dimension}]
 * @returns {string} MBTI type like "INFJ"
 */
export function scoreMBTI(answers) {
  const counts = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };

  for (const answer of answers) {
    counts[answer.selectedPole] = (counts[answer.selectedPole] || 0) + 1;
  }

  const mbti =
    (counts.E >= counts.I ? 'E' : 'I') +
    (counts.S >= counts.N ? 'S' : 'N') +
    (counts.T >= counts.F ? 'T' : 'F') +
    (counts.J >= counts.P ? 'J' : 'P');

  return mbti;
}

export default MBTI_QUESTIONS;
