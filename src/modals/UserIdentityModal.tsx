import { type FormEvent, useState } from "react";
import type { UserProfile } from "../model/types";
import type { UserProfileFormState } from "../view-types";
import { Modal } from "../ui/Modal";

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
    <Modal
      dismissible={!required}
      subtitle={<p>Choose the display name shown in this party.</p>}
      title={profile ? "Edit user" : "Set user"}
      onClose={onCancel}
    >
      <form className="modal-form" onSubmit={handleSubmit}>
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
    </Modal>
  );
}
