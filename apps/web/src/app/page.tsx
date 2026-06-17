import { redirect } from 'next/navigation';

// Harmony is a free, account-less music player — the old marketing/login
// landing page is gone. Opening the app drops you straight into the music.
export default function RootPage() {
  redirect('/home');
}
