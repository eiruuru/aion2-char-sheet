import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import { hydrateDesktopSave } from "./desktop"
import { PetPopupApp } from "./ui/PetPopup"
import "./styles.css"

void hydrateDesktopSave().finally(() => {
  const root = document.getElementById("root")
  if (!root) throw new Error("Missing root")
  const petWindow = window.location.hash === "#pet"
  if (petWindow) document.body.classList.add("pet-pop-body")
  createRoot(root).render(
    <StrictMode>
      {petWindow ? <PetPopupApp /> : <App />}
    </StrictMode>,
  )
})
