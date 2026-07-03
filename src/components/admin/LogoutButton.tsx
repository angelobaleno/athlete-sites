import './LogoutButton.css';

export default function LogoutButton() {
  async function onClick() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return <button type="button" class="logout-btn" onClick={onClick}>Sign out</button>;
}
