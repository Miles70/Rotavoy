import { Outlet } from "react-router-dom";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";

function MainLayout() {
  return (
    <div className="app">
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}

export default MainLayout;