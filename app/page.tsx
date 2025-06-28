import AuthProvider from '@/components/AuthProvider';
import MainApp from '@/components/MainApp';

export default function Home() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
