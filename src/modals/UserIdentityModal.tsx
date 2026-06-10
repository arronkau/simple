import { type FormEvent, useState } from "react";
import type { UserProfile } from "../model/types";
import type { UserProfileFormState } from "../view-types";

export function UserIdentityModal({
  profile,
  required,
  onCancel,
  onSubmit,
}: {
  profile?: UserProfile;
  required: boolean;
  onCancel: () => void;
  onSubmit: (input: UserProfileFormState) => void;
}) {
  const [formState, setFormState] = useState<UserProfileFormState>({
    displayName: profile?.displayName ?? "",
    role: profile?.role ?? "Player",
  });
  const displayNameValid = formState.displayName.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!displayNameValid) {
      return;
    }

    onSubmit(formState);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label="User identity"
        aria-modal="true"
        className="modal-panel manage-modal"
        role="dialog"
      >
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-header">
            <div>
              <h2>{profile ? "Edit User" : "Join Party"}</h2>
              <p>Name yourself for this party.</p>
            </div>
            {required ? null : (
              <button type="button" onClick={onCancel}>
                Close
              </button>
            )}
          </div>

          <div className="modal-body">
            <section className="manage-section">
              <label>
                <span>Display name</span>
                <input
                  autoFocus
                  autoComplete="name"
                  value={formState.displayName}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      displayName: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Role</span>
                <select
                  value={formState.role}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      role: event.target.value as "GM" | "Player",
                    }))
                  }
                >
                  <option value="Player">Player</option>
                  <option value="GM">GM</option>
                </select>
              </label>

              {!displayNameValid ? (
                <p className="form-error">Enter a display name.</p>
              ) : null}
            </section>
          </div>

          <div className="modal-footer">
            {required ? null : (
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button disabled={!displayNameValid} type="submit">
              Save user
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
