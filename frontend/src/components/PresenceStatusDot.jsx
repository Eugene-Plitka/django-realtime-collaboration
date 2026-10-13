import {
  usePresence,
} from "../presence/PresenceContext";


const STATUS_META = {
  ONLINE: {
    className: "online",
    label: "Online",
  },
  AWAY: {
    className: "away",
    label: "Away",
  },
  DND: {
    className: "dnd",
    label: "Do Not Disturb",
  },
};


function PresenceStatusDot({
  userId,
  status = "ONLINE",
  className = "",
}) {
  const {
    getPresenceStatus,
  } = usePresence();

  const currentStatus =
    getPresenceStatus(
      userId,
      status,
    );

  const statusMeta =
    STATUS_META[
      currentStatus
    ] ??
    STATUS_META.ONLINE;


  return (
    <span
      className={[
        "presence-status-dot",
        statusMeta.className,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={
        statusMeta.label
      }
      aria-label={
        statusMeta.label
      }
    />
  );
}


export default PresenceStatusDot;