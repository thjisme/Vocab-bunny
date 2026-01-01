
import { User, Word } from '../types';

const STORAGE_KEY = 'vocabbunny_data';

export const getStoredUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

export const getCurrentUser = (): User | null => {
  const userId = localStorage.getItem('vocabbunny_current_user');
  if (!userId) return null;
  const users = getStoredUsers();
  return users.find(u => u.id === userId) || null;
};

export const logoutUser = () => {
  localStorage.removeItem('vocabbunny_current_user');
};

export const updateWordInList = (userId: string, word: Word) => {
  const users = getStoredUsers();
  const userIdx = users.findIndex(u => u.id === userId);
  if (userIdx > -1) {
    const wordIdx = users[userIdx].wordList.findIndex(w => w.id === word.id);
    if (wordIdx > -1) {
      users[userIdx].wordList[wordIdx] = word;
    } else {
      users[userIdx].wordList.push(word);
    }
    saveUsers(users);
  }
};
