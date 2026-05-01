import { Route, Routes } from "react-router-dom";
import About from "./pages/About";
import Embed from "./pages/Embed";
import Home from "./pages/Home";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/embed" element={<Embed />} />
    </Routes>
  );
}
