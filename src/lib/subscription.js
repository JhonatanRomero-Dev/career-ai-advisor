export function getStoredCurrentUser() {
  const savedUser = localStorage.getItem("career-ai-current-user");

  if (!savedUser) {
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    return null;
  }
}
