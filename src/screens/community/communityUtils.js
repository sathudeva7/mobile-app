import { Colors } from '../../theme';

export const AVATAR_PALETTES = [
  { bg: 'rgba(27,107,107,0.10)', text: Colors.teal },
  { bg: 'rgba(212,147,58,0.12)', text: Colors.gold },
  { bg: 'rgba(46,139,87,0.10)', text: '#2E8B57' },
  { bg: 'rgba(61,124,201,0.10)', text: '#3D7CC9' },
  { bg: 'rgba(150,80,180,0.10)', text: '#9650B4' },
];

export function avatarColor(name = '') {
  const code = name.charCodeAt(0);
  const i = Number.isNaN(code) ? 0 : code % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[i];
}

export function getInitials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function formatTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
