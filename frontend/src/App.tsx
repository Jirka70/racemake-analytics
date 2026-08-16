import { Navigate, Route, Routes } from 'react-router-dom'
import { AnalysisPage } from './pages/AnalysisPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/analysis/preview" replace />} />
      <Route path="/analysis/:analysisId" element={<AnalysisPage />} />
      <Route path="*" element={<Navigate to="/analysis/preview" replace />} />
    </Routes>
  )
}
