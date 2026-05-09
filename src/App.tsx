import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { WordsPage } from "./pages/WordsPage";
import { AddManualPage } from "./pages/AddManualPage";
import { AddImagePage } from "./pages/AddImagePage";
import { WordDetailPage } from "./pages/WordDetailPage";
import { ReviewHomePage } from "./pages/ReviewHomePage";
import { ReviewSessionPage } from "./pages/ReviewSessionPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/words" replace />} />
        <Route path="/words" element={<WordsPage />} />
        <Route path="/words/:id" element={<WordDetailPage />} />
        <Route path="/add" element={<AddManualPage />} />
        <Route path="/add/image" element={<AddImagePage />} />
        <Route path="/review" element={<ReviewHomePage />} />
        <Route path="/review/session" element={<ReviewSessionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/words" replace />} />
      </Routes>
    </Layout>
  );
}
