import { BackboneUser } from "../Models/BackboneUser";
import { Tournament, TournamentInput } from "../Models/Tournament";
import { v4 as uuidv4 } from "uuid";
import { msg } from "../Modules/Logger";
import { GenerateInviteId } from "../Modules/Extensions";
import { TournamentPhaseType, Scenes, Emotes } from "../Backbone/Config";

const WEBHOOK_URI = process.env.WEBHOOK_URI || "https://discord.com/api/webhooks/1543304073401339944/8wfe8E_V5zCR9XqFhvJgnrAiZQvyvizp9haFJGg9IvbO6gGAMXyg9xcc_eZfQC1w1HnF"

function getMapFriendlyName(sceneId: string): string {
  const mapName = Object.keys(Scenes).find((key) => Scenes[key as keyof typeof Scenes] === sceneId);
  return mapName || sceneId;
}

function getEmoteFriendlyName(emoteId: number): string {
  const emoteName = Object.keys(Emotes).find((key) => Emotes[key as keyof typeof Emotes] === emoteId);
  return emoteName || `${emoteId}`;
}

async function SendWebhook(tournament: any): Promise<void> {
  if (!WEBHOOK_URI) {
    return;
  }

  try {
    const hexColor = tournament.TournamentColor?.replace("#", "") || "29e0ff";
    const decimalColor = parseInt(hexColor.substring(0, 6), 16);

    const isFFA = tournament.PartySize === 1 && tournament.MaxPlayersPerMatch > 2;
    const modeText = isFFA
      ? Array(tournament.MaxPlayersPerMatch).fill("1").join("v")
      : `${tournament.PartySize}v${tournament.PartySize}`;

    const getPhaseTypeName = (phaseType: number): string => {
      switch (phaseType) {
        case TournamentPhaseType.RoundRobin:
          return "Normal Phase (Round Robin)";
        case TournamentPhaseType.Arena:
          return "Arena";
        case TournamentPhaseType.SingleEliminationBracket:
          return "SE Bracket";
        default:
          return "Phase";
      }
    };

    const disabledEmotes = tournament.Properties?.DisabledEmotes || [];
    const emotesEnabled = disabledEmotes.length === 0;
    const emotesEmoji = emotesEnabled ? "<:punch~2:1473721156652499036>" : "<:cross:1343647963418726520>";

    const signupTimestamp = Math.floor(new Date(tournament.SignupStart).getTime() / 1000);
    const startTimestamp = Math.floor(new Date(tournament.StartTime).getTime() / 1000);

    // Build phases content
    let phasesContent = `# <a:WhiteCrown:1354891781749346405> Phases\n- **Emotes:** <:punch~2:1473721156652499036>`;

    if (tournament.Phases && tournament.Phases.length > 0) {
      tournament.Phases.forEach((phase: any, index: number) => {
        const phaseTypeName = getPhaseTypeName(Number(phase.PhaseType));
        const mapNames =
          phase.Maps && phase.Maps.length > 0
            ? phase.Maps.map((sceneId: string) => getMapFriendlyName(sceneId)).join(" & ")
            : "NA";

        phasesContent += `\n- **Maps**: **${mapNames}**`;
        phasesContent += `\n- **Phase ${index + 1}**`;
        phasesContent += `\n> Type: **${phaseTypeName}**`;

        if (phase.RoundCount) {
          phasesContent += `\n> Rounds: **${phase.RoundCount}**`;
        }

        if (phase.MaxTeams) {
          phasesContent += `\n> Teams: **${phase.MaxTeams}**`;
        }

        if (phase.GroupCount && phase.GroupCount > 1) {
          phasesContent += `\n> Passing Teams: **${phase.GroupCount}**`;
        }
      });
    }

    const payload = {
      components: [
        {
          type: "container",
          accent_color: decimalColor,
          items: [
            {
              type: "section",
              children: [
                {
                  type: "text_display",
                  content: `## <:trophy:1343642129280401460> **New Tournament Created**\n<@&1424022947789799424>`,
                },
              ],
              accessory: {
                type: "thumbnail",
                url:
                  tournament.TournamentImage ||
                  "https://cdn.stumblepriv.com/Emotes/Emote007_Crown.png",
              },
            },
            {
              type: "separator",
              spacing: 1,
              visible: true,
            },
            {
              type: "text_display",
              content:
                `# <:sgpriv:1453586751154294945> Overview\n` +
                `- *Name:* **${tournament.TournamentName}**\n` +
                `- *Region:* **${tournament.Region.toUpperCase()}**\n` +
                `- *Mode:* **${modeText}**\n` +
                `- *Max Players*: **${tournament.MaxInvites}**\n` +
                `- *Phases:* **${tournament.Phases?.length || 0}**\n` +
                `- *Entry-Fee:* **Free**\n` +
                `- *Sign-ups:* <t:${signupTimestamp}:f>\n` +
                `- *Start:* <t:${startTimestamp}:f>`,
            },
            {
              type: "separator",
              spacing: 1,
              visible: true,
            },
            {
              type: "text_display",
              content: phasesContent,
            },
          ],
        },
      ],
    };

    const webhookUrl =
      WEBHOOK_URI.replace("https://discord.com/api/webhooks/", "https://discord.com/api/v10/webhooks/") +
      "?wait=true&with_components=true";

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook failed: ${response.status} - ${errorText}`);
    }
  } catch (err) {
    throw err;
  }
}

export async function CreateTournament(tournamentData: TournamentInput) {
  let signupStart = tournamentData.SignupStart ?? new Date(tournamentData.StartTime.getTime() - 60 * 60 * 1000);

  const tournament = new Tournament({
    ...tournamentData,
    SignupStart: signupStart,
  });

  const saved = await tournament.save();

  // Send webhook asynchronously to not block tournament creation
  SendWebhook(saved).catch((err) => {
    console.error("Webhook failed:", err);
  });

  return saved;
}

async function GenerateUserId(): Promise<string> {
  const UsersCollection = BackboneUser.collection;

  let unique = false;
  let userId = "";

  while (!unique) {
    userId = Math.floor(10000 + Math.random() * 90000).toString();
    const exists = await UsersCollection.findOne({ UserId: userId });
    if (!exists) unique = true;
  }

  return userId;
}

export async function CreateSignedUpUser(Times: number, TournamentId: string) {
  const users = [];
  const DBTour = await Tournament.findOne({ TournamentId });

  if (!DBTour) {
    msg("Please provide a valid tournamentid :)");
    return;
  }

  const partySize = DBTour.PartySize;

  for (let i = 0; i < Times / partySize; i++) {
    const partyCode = uuidv4();
    const partyMembers = [];
    const AcceptedAt = new Date();

    for (let j = 0; j < partySize; j++) {
      const UserId = await GenerateUserId();
      const Username = `Tournament-SDK #${Math.random().toString(36).substring(2, 8)}`;
      const IsPartyLeader = j === 0;

      partyMembers.push({
        UserId,
        Username,
        Status: 1,
        IsPartyLeader,
      });
    }

    for (const member of partyMembers) {
      const user = new BackboneUser({
        Username: member.Username,
        UserId: member.UserId,
        Tournaments: {
          [TournamentId]: {
            SignedUp: true,
            InviteId: GenerateInviteId(),
            Status: 1,
            AcceptedAt,
            PartyCode: partyCode,
            KnockedOut: false,
            PartyMembers: partyMembers,
            UserMatch: null,
            UserMatches: [],
            UserPosition: [],
            FinalPlace: 0,
          },
        },
      });

      users.push(user.save());
    }
  }

  return await Promise.all(users);
}
