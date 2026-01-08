import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Suspense, lazy, createContext, useContext, useEffect, useState } from "react";
import { ProjectSelector } from "./components/ProjectSelector";
import { ChatPage } from "./components/ChatPage";
import { SettingsProvider } from "./contexts/SettingsContext";
import { isDevelopment } from "./utils/environment";

// Lazy load DemoPage only in development
const DemoPage = isDevelopment()
  ? lazy(() =>
      import("./components/DemoPage").then((module) => ({
        default: module.DemoPage,
      })),
    )
  : null;

// Context for managing current project path
interface ProjectContextValue {
  projectPath: string | null;
  setProjectPath: (path: string | null) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  projectPath: null,
  setProjectPath: () => {},
});

export const useProject = () => useContext(ProjectContext);

/**
 * Root component that fetches config and manages project state
 */
function AppRoot() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    // Fetch config to get default project
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.defaultProjectPath) {
          setProjectPath(data.defaultProjectPath);
        }
        setConfigLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to fetch config:", err);
        setConfigLoaded(true);
      });
  }, []);

  if (!configLoaded) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <ProjectContext.Provider value={{ projectPath, setProjectPath }}>
      {projectPath ? <ChatPage /> : <ProjectSelector onProjectSelect={setProjectPath} />}
    </ProjectContext.Provider>
  );
}

function App() {
  return (
    <SettingsProvider>
      <Router>
        <Routes>
          <Route path="*" element={<AppRoot />} />
          {DemoPage && (
            <Route
              path="/demo"
              element={
                <Suspense fallback={<div>Loading demo...</div>}>
                  <DemoPage />
                </Suspense>
              }
            />
          )}
        </Routes>
      </Router>
    </SettingsProvider>
  );
}

export default App;
