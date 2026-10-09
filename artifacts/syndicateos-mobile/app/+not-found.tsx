import { Redirect } from 'expo-router';

// Legacy demo routes are retired; everything lives at the root workspace.
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
