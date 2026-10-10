function MemberProfilePopover({
  member,
  onClose,
}) {
  if (!member) {
    return null;
  }

  return (
    <div
      className="member-profile-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="member-profile-popover"
        role="dialog"
        aria-modal="true"
        aria-label={`${member.username} profile`}
      >
        <button
          className="member-profile-close"
          type="button"
          aria-label="Close profile"
          onClick={onClose}
        >
          ×
        </button>

        <div className="member-profile-banner" />

        <div className="member-profile-avatar">
          {member.username
            ?.slice(0, 1)
            .toUpperCase()}
        </div>

        <div className="member-profile-content">
          <h2>
            {member.username}
          </h2>

          <span>
            {member.email}
          </span>

          {member.role && (
            <div className="member-profile-role">
              {member.role}
            </div>
          )}

          <div className="member-profile-divider" />

          <strong>
            Member profile
          </strong>

          <p>
            Full user profiles will be
            added later. This card is the
            entry point for that feature.
          </p>
        </div>
      </section>
    </div>
  );
}


export default MemberProfilePopover;