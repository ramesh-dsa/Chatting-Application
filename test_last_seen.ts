import { formatLastSeen } from './src/utils/formatLastSeen';
const now = new Date();
console.log('2 mins ago:', formatLastSeen(now.getTime() - 2 * 60 * 1000));
console.log('yesterday:', formatLastSeen(now.getTime() - 24 * 60 * 60 * 1000));
console.log('3 days ago:', formatLastSeen(now.getTime() - 3 * 24 * 60 * 60 * 1000));
console.log('3 weeks ago:', formatLastSeen(now.getTime() - 21 * 24 * 60 * 60 * 1000));
