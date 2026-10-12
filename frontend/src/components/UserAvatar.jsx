import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getApiBaseUrl,
} from "../api/client";


const AVATAR_COLORS = [
  "#4057f6",
  "#7c3aed",
  "#0f766e",
  "#b45309",
  "#be123c",
  "#0369a1",
  "#4f46e5",
  "#a21caf",
  "#047857",
  "#c2410c",
];


function avatarColor(
  username,
) {
  const value =
    username ?? "";

  let hash = 0;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash =
      (
        hash * 31 +
        value.charCodeAt(index)
      ) >>> 0;
  }

  return AVATAR_COLORS[
    hash %
      AVATAR_COLORS.length
  ];
}


function resolveAvatarUrl(
  avatarUrl,
) {
  if (!avatarUrl) {
    return null;
  }

  if (
    avatarUrl.startsWith(
      "http://",
    ) ||
    avatarUrl.startsWith(
      "https://",
    )
  ) {
    return avatarUrl;
  }

  const apiBaseUrl =
    getApiBaseUrl();

  if (!apiBaseUrl) {
    return avatarUrl;
  }

  return (
    `${apiBaseUrl}${
      avatarUrl.startsWith("/")
        ? ""
        : "/"
    }${avatarUrl}`
  );
}


function UserAvatar({
  username,
  avatarUrl,
  className = "",
}) {
  const [
    imageFailed,
    setImageFailed,
  ] = useState(false);


  const resolvedAvatarUrl =
    useMemo(
      () =>
        resolveAvatarUrl(
          avatarUrl,
        ),
      [
        avatarUrl,
      ],
    );


  useEffect(() => {
    setImageFailed(false);
  }, [
    resolvedAvatarUrl,
  ]);


  const showImage =
    Boolean(
      resolvedAvatarUrl,
    ) &&
    !imageFailed;


  const initial =
    username
      ?.trim()
      .slice(0, 1)
      .toUpperCase() ||
    "?";


  return (
    <div
      className={[
        "user-avatar",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        showImage
          ? undefined
          : {
              backgroundColor:
                avatarColor(
                  username,
                ),
            }
      }
      aria-hidden="true"
    >
      {showImage ? (
        <img
          className="user-avatar-image"
          src={
            resolvedAvatarUrl
          }
          alt=""
          onError={() =>
            setImageFailed(true)
          }
        />
      ) : (
        <span className="user-avatar-fallback">
          {initial}
        </span>
      )}
    </div>
  );
}


export default UserAvatar;