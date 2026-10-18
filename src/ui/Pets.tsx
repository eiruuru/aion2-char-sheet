import type { CharacterRecord } from "../model/store"
import { emptyPetTrack, trackFill, type PetTrack } from "../model/petProgress"
import { PETS, petById, soulsToNext, type CatalogPet } from "../model/pets"
import { parseStoredNumber } from "../model/store"

export function PetsScreen({
  character,
  waiting,
  recentMobs,
  detailId,
  onBack,
  onOpen,
  onCloseDetail,
  onSaveTrack,
}: {
  character: CharacterRecord | null
  waiting: boolean
  recentMobs: string[]
  detailId: string | null
  onBack: () => void
  onOpen: (petId: string) => void
  onCloseDetail: () => void
  onSaveTrack: (petId: string, track: PetTrack) => void
}) {
  const detail = petById(detailId)
  const tracks = character?.petTracks ?? {}
  return (
    <section className="pets-screen panel">
      <div className="pets-head">
        <button type="button" className="quiet" onClick={onBack}>Back to sheet</button>
        <div>
          <h2>Pets</h2>
          <p className="muted">
            {character ? character.name : "No character on this roster yet."}
            {waiting ? " · Waiting for the character who is logged in." : ""}
          </p>
        </div>
      </div>
      {detail && character ? (
        <PetDetail
          pet={detail}
          track={tracks[detail.id] ?? emptyPetTrack()}
          portrait={portraitFor(character, detail)}
          recentMobs={recentMobs}
          onClose={onCloseDetail}
          onSave={(track) => onSaveTrack(detail.id, track)}
        />
      ) : (
        <div className="pet-grid">
          {PETS.map((pet) => {
            const track = tracks[pet.id] ?? emptyPetTrack()
            const next = soulsToNext(track.level)
            const active = character?.trackingPetId === pet.id
            return (
              <button
                key={pet.id}
                type="button"
                className={active ? "pet-tile active" : "pet-tile"}
                onClick={() => onOpen(pet.id)}
              >
                <PetPortrait pet={pet} src={portraitFor(character, pet)} />
                <span className="pet-tile-name">{pet.name}</span>
                <span className="muted">Lv {track.level} · {track.kills}{next ? ` / ${next}` : ""}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function PetDetail({
  pet,
  track,
  portrait,
  recentMobs,
  onClose,
  onSave,
}: {
  pet: CatalogPet
  track: PetTrack
  portrait: string | null
  recentMobs: string[]
  onClose: () => void
  onSave: (track: PetTrack) => void
}) {
  const next = soulsToNext(track.level)
  const fill = trackFill(track)
  return (
    <div className="pet-detail">
      <button type="button" className="quiet" onClick={onClose}>All pets</button>
      <div className="pet-detail-top">
        <PetPortrait pet={pet} src={portrait} />
        <div>
          <h3>{pet.name}</h3>
          <p className="muted">{pet.genus} · Lv {track.level}</p>
        </div>
      </div>
      {next ? (
        <>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={next} aria-valuenow={Math.min(track.kills, next)} aria-label={`${pet.name} souls`}>
            <span style={{ width: `${fill * 100}%` }} />
          </div>
          <p className="odyle-readout">{track.kills} / {next} souls from kills</p>
        </>
      ) : (
        <p className="odyle-readout">{track.kills} kills · highest level</p>
      )}
      <form className="odyle-controls" onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const level = parseStoredNumber(String(data.get("level") ?? ""))
        const kills = parseStoredNumber(String(data.get("kills") ?? ""))
        if (level == null || kills == null) return
        onSave({ level: Math.min(level, 3), kills })
      }}>
        <label>
          Level
          <input name="level" key={`${pet.id}-level-${track.level}`} className="timer-input" inputMode="numeric" autoComplete="off" defaultValue={String(track.level)} />
        </label>
        <label>
          Kills
          <input name="kills" key={`${pet.id}-kills-${track.kills}`} inputMode="numeric" autoComplete="off" defaultValue={String(track.kills)} />
        </label>
        <button type="submit" className="icon-button" aria-label="Save pet progress" title="Save pet progress">
          <CheckIcon />
        </button>
      </form>
      <div>
        <h3>Currently hitting</h3>
        {recentMobs.length ? (
          <ul className="pet-mobs">
            {recentMobs.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}
          </ul>
        ) : (
          <p className="muted">No recent kills yet. Any mob in the pull counts toward this pet.</p>
        )}
      </div>
    </div>
  )
}

function PetPortrait({ pet, src }: { pet: CatalogPet; src: string | null }) {
  if (src) return <img className="pet-portrait" src={src} alt="" />
  return <span className={`pet-portrait genus-${pet.genus.toLowerCase()}`} aria-hidden="true">{pet.name.slice(0, 1)}</span>
}

function portraitFor(character: CharacterRecord | null, pet: CatalogPet): string | null {
  const equipped = character?.latest?.pet
  if (equipped?.icon && equipped.name?.toLowerCase() === pet.name.toLowerCase()) return equipped.icon
  return null
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.2 6.2 11.5 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
