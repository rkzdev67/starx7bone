import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { CreateTournament } from "./Database";
import { GeneratePrizepoolId } from "../Modules/Extensions";
import {
  Emotes,
  Scenes,
  TournamentPhaseType,
  Regions,
  TournamentStatus,
  TournamentSignUpStatus,
  TournamentType,
  TournamentUserStatus,
  TournamentHubMatchStatus,
  TournamentMatchStatus,
  TournamentMode,
  MapTypes,
  SceneTypes,
  OverrideTournamentMode,
} from "../Backbone/Config";
import { Tournament } from "../Models/Tournament";
import { BackboneUser } from "../Models/BackboneUser";
import { Match } from "../Models/Matches";
import { Qualify } from "../Backbone/Logic/GetMatches";

export const Bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── AUTHORIZED USERS ────────────────────────────────────────────────────────
const AUTHORIZED_USERS = [
  "1532130478637715576",
];

// ─── SCHEDULED TOURNAMENTS ────────────────────────────────────────────────────
interface ScheduledTournamentConfig {
  scheduleId: string;
  scheduledFor: Date;
  createdBy: string;
  config: any;
  timer: ReturnType<typeof setTimeout>;
}
const scheduledTournaments = new Map<string, ScheduledTournamentConfig>();

// ─── REGION CHOICES ────────────────────────────────────────────────────────────
const regionChoices = Object.keys(Regions)
  .filter((k) => isNaN(Number(k)))
  .map((name) => ({
    name,
    value: Regions[name as keyof typeof Regions],
  }));

// ─── MAP CHOICES ────────────────────────────────────────────────────────────────
const ALL_MAP_CHOICES = Object.keys(Scenes)
  .filter((k) => isNaN(Number(k)))
  .map((mapName) => ({
    name: mapName,
    value: mapName,
  }));

const mapChoicesSlice1 = ALL_MAP_CHOICES.slice(0, 25);
const mapChoicesSlice2 = ALL_MAP_CHOICES.slice(25, 50);
const mapChoicesSlice3 = ALL_MAP_CHOICES.slice(50, 75);
const mapChoicesSlice4 = ALL_MAP_CHOICES.slice(75);

// ─── EMOTE PRESET CHOICES ─────────────────────────────────────────────────────
const EMOTE_PRESETS = [
  { name: "Todos Permitidos", value: "all" },
  { name: "Sem Emotes", value: "0" },
  { name: "Punch Only", value: "-2" },
  { name: "Punch & Kick Only", value: "-3" },
  { name: "Special Emotes Only", value: "-1" },
  { name: "Banana Only", value: "-4" },
  { name: "Hug Only", value: "-5" },
];

// ─── TOURNAMENT PHASE TYPE CHOICES ───────────────────────────────────────────
const phaseTypeChoices = Object.keys(TournamentPhaseType)
  .filter((k) => isNaN(Number(k)))
  .map((name) => ({
    name: name.replace(/([A-Z])/g, " $1").trim(),
    value: TournamentPhaseType[name as keyof typeof TournamentPhaseType].toString(),
  }));

// ─── TOURNAMENT MODES ─────────────────────────────────────────────────────────
const TOURNAMENT_MODES = [
  { label: "1v1 - 4 vagas - 2 rounds", partySize: 1, maxInvites: 4, rounds: 2 },
  { label: "1v1 - 8 vagas - 3 rounds", partySize: 1, maxInvites: 8, rounds: 3 },
  { label: "1v1 - 16 vagas - 4 rounds", partySize: 1, maxInvites: 16, rounds: 4 },
  { label: "1v1 - 32 vagas - 5 rounds", partySize: 1, maxInvites: 32, rounds: 5 },
  { label: "1v1 - 64 vagas - 6 rounds", partySize: 1, maxInvites: 64, rounds: 6 },
  { label: "2v2 - 4 vagas - 1 round", partySize: 2, maxInvites: 4, rounds: 1 },
  { label: "2v2 - 8 vagas - 2 rounds", partySize: 2, maxInvites: 8, rounds: 2 },
  { label: "2v2 - 16 vagas - 3 rounds", partySize: 2, maxInvites: 16, rounds: 3 },
  { label: "2v2 - 32 vagas - 4 rounds", partySize: 2, maxInvites: 32, rounds: 4 },
  { label: "2v2 - 64 vagas - 5 rounds", partySize: 2, maxInvites: 64, rounds: 5 },
  { label: "3v3 - 6 vagas - 1 round", partySize: 3, maxInvites: 6, rounds: 1 },
  { label: "3v3 - 12 vagas - 2 rounds", partySize: 3, maxInvites: 12, rounds: 2 },
  { label: "3v3 - 24 vagas - 3 rounds", partySize: 3, maxInvites: 24, rounds: 3 },
  { label: "3v3 - 48 vagas - 4 rounds", partySize: 3, maxInvites: 48, rounds: 4 },
  { label: "4v4 - 8 vagas - 1 round", partySize: 4, maxInvites: 8, rounds: 1 },
  { label: "4v4 - 16 vagas - 2 rounds", partySize: 4, maxInvites: 16, rounds: 2 },
  { label: "4v4 - 32 vagas - 3 rounds", partySize: 4, maxInvites: 32, rounds: 3 },
  { label: "4v4 - 64 vagas - 4 rounds", partySize: 4, maxInvites: 64, rounds: 4 },
];

// ─── TOURNAMENT TYPE CHOICES ──────────────────────────────────────────────────
const tournamentTypeChoices = Object.keys(TournamentType)
  .filter((k) => isNaN(Number(k)))
  .map((name) => ({
    name: name.replace(/([A-Z])/g, " $1").trim(),
    value: TournamentType[name as keyof typeof TournamentType].toString(),
  }));

// ─── LABELS ───────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<number, string> = {
  [-1]: "Desconhecido",
  0: "Não Iniciado",
  1: "Inscrições Abertas",
  2: "Inscrições Fechadas",
  3: "Finalizado",
  4: "Cancelado",
  5: "Em Andamento",
};

// ─── BOT READY ────────────────────────────────────────────────────────────────
Bot.on("ready", async () => {
  console.log(`✅ Bot conectado como ${Bot.user?.tag}`);

  const modeChoices = TOURNAMENT_MODES.slice(0, 25).map((mode, index) => ({
    name: mode.label,
    value: index,
  }));

  const commands = [
    new SlashCommandBuilder()
      .setName("criar-torneio")
      .setDescription("🏆 Criar um novo torneio")
      .addStringOption((opt) =>
        opt.setName("nome").setDescription("Nome do torneio").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("modo")
          .setDescription("Modo do torneio (partySize x rounds x vagas)")
          .setRequired(true)
          .addChoices(...modeChoices)
      )
      .addStringOption((opt) =>
        opt
          .setName("regiao")
          .setDescription("Região do servidor")
          .setRequired(true)
          .addChoices(...regionChoices)
      )
      .addStringOption((opt) =>
        opt
          .setName("mapa")
          .setDescription("Mapa do torneio (parte 1: A-D)")
          .setRequired(true)
          .addChoices(...mapChoicesSlice1)
      )
      .addIntegerOption((opt) =>
        opt.setName("inicio").setDescription("Inicia em X minutos").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("tipo")
          .setDescription("Tipo de torneio")
          .setRequired(false)
          .addChoices(...tournamentTypeChoices.slice(0, 4))
      )
      .addStringOption((opt) =>
        opt
          .setName("fase")
          .setDescription("Tipo de fase/bracket")
          .setRequired(false)
          .addChoices(...phaseTypeChoices.slice(0, 5))
      )
      .addIntegerOption((opt) =>
        opt.setName("inscricao").setDescription("Inscrições abrem em X minutos").setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt.setName("taxa").setDescription("Taxa de entrada (diamonds)").setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("restricoes")
          .setDescription("Preset de restrição de emotes")
          .setRequired(false)
          .addChoices(...EMOTE_PRESETS)
      )
      .addStringOption((opt) =>
        opt
          .setName("emotesdesabilitados")
          .setDescription("Emotes desabilitados por nome ou ID (separados por vírgula)")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName("imagem").setDescription("URL da imagem/thumbnail do torneio").setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName("cor").setDescription("Cor do embed em hexadecimal (ex: #FF5500)").setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName("stream").setDescription("URL da stream/transmissão").setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("convidados")
          .setDescription("IDs de usuários convidados (separados por vírgula) — torna o torneio privado")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("premios")
          .setDescription("Prêmios por posição (formato: 1:1000,2:500,3:250)")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("admins")
          .setDescription("IDs de admins adicionais (separados por vírgula)")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("agendar")
          .setDescription("Agendar para data/hora (DD/MM/AAAA,HH:MM) — ex: 27/02/2026,20:00")
          .setRequired(false)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("listar")
      .setDescription("📋 Listar torneios ativos")
      .toJSON(),

    new SlashCommandBuilder()
      .setName("matches")
      .setDescription("⚔️ Ver matches em andamento e decidir vencedores")
      .addStringOption((opt) =>
        opt
          .setName("torneio")
          .setDescription("ID do torneio (deixe vazio para ver todos)")
          .setRequired(false)
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN || "");

  try {
    console.log("📡 Registrando comandos slash...");
    await rest.put(Routes.applicationCommands(Bot.user?.id || ""), { body: commands });
    console.log("✅ Comandos registrados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos:", error);
  }
});

// ─── INTERACTION HANDLER ──────────────────────────────────────────────────────
Bot.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    }
  } catch (error) {
    console.error("❌ Erro no interaction handler:", error);
  }
});

// ─── AUTH CHECK ───────────────────────────────────────────────────────────────
async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
    await interaction.reply({
      content: "❌ Você não tem permissão para usar este bot.",
      ephemeral: true,
    });
    return;
  }

  switch (interaction.commandName) {
    case "criar-torneio":
      await createTournamentCommand(interaction);
      break;
    case "listar":
      await listTournaments(interaction);
      break;
    case "matches":
      await listMatches(interaction);
      break;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseEmotes(emotesInput: string): number[] {
  return emotesInput
    .split(",")
    .map((e) => {
      const trimmed = e.trim();
      const emoteId = Emotes[trimmed as keyof typeof Emotes];
      if (emoteId !== undefined) return emoteId as number;
      const lowerTrimmed = trimmed.toLowerCase();
      const matchKey = Object.keys(Emotes).find(
        (k) => isNaN(Number(k)) && k.toLowerCase().includes(lowerTrimmed)
      );
      if (matchKey) return Emotes[matchKey as keyof typeof Emotes] as number;
      const parsed = parseInt(trimmed);
      return isNaN(parsed) ? null : parsed;
    })
    .filter((id): id is number => id !== null);
}

function parsePrizes(prizesInput: string): Array<{ position: number; amount: number }> {
  return prizesInput
    .split(",")
    .map((p) => {
      const parts = p.trim().split(":");
      if (parts.length === 2) {
        const position = parseInt(parts[0]);
        const amount = parseInt(parts[1]);
        if (!isNaN(position) && !isNaN(amount)) return { position, amount };
      }
      return null;
    })
    .filter((prize): prize is { position: number; amount: number } => prize !== null);
}

function getEmoteDisplayName(id: number): string {
  const PRESET_NAMES: Record<number, string> = {
    0: "Sem Emotes",
    [-1]: "Special Emotes Only",
    [-2]: "Punch Only",
    [-3]: "Punch & Kick Only",
    [-4]: "Banana Only",
    [-5]: "Hug Only",
  };
  if (id in PRESET_NAMES) return PRESET_NAMES[id];
  const name = Object.keys(Emotes).find(
    (k) => isNaN(Number(k)) && (Emotes[k as keyof typeof Emotes] as number) === id
  );
  return name ? name : `ID:${id}`;
}

function getEmoteNames(emoteIds: number[]): string {
  if (!emoteIds || emoteIds.length === 0) return "Todos Permitidos";
  return emoteIds.map(getEmoteDisplayName).join(", ");
}

function getModeLabel(partySize: number): string {
  const modeMap: Record<number, string> = {
    1: "1v1",
    2: "2v2",
    3: "3v3",
    4: "4v4",
  };
  return modeMap[partySize] || `${partySize}v${partySize}`;
}

function getMapType(sceneName: string): string {
  const sceneValue = Scenes[sceneName as keyof typeof Scenes];
  if (!sceneValue) return "Desconhecido";
  const type = SceneTypes[sceneValue as keyof typeof SceneTypes];
  return type || "Desconhecido";
}

function getMapTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    Race: "🏃",
    Elimination: "💀",
    Shooter: "🔫",
    Driving: "🚗",
    Collect: "🪙",
    Race_Survive: "☠️🏃",
    Team: "👥",
  };
  return emojis[type] || "🗺️";
}

function calculateTournamentStatus(tournament: any): number {
  const now = new Date();
  const opens = new Date(tournament.SignupStart);
  const starts = new Date(tournament.StartTime);
  const closes = new Date(starts.getTime() - 75 * 1000);

  if (tournament.Status === TournamentStatus.Canceled || tournament.Status === TournamentStatus.Finished) {
    return tournament.Status;
  }

  if (now < opens) return TournamentStatus.NotStarted;
  if (now <= closes) return TournamentStatus.InvitationOpen;
  if (now < starts) return TournamentStatus.InvitationClose;
  if (tournament.Status === TournamentStatus.Running) return TournamentStatus.Running;
  return TournamentStatus.Running;
}

function buildTournamentEmbed(t: any, calculatedStatus?: number): EmbedBuilder {
  const status = calculatedStatus ?? calculateTournamentStatus(t);
  const colorValue = parseInt((t.TournamentColor || "#2ad100").replace("#", ""), 16);
  const statusLabel = STATUS_LABELS[status] || "Desconhecido";

  const mapName = Object.keys(Scenes).find(
    (k) => isNaN(Number(k)) && Scenes[k as keyof typeof Scenes] === (t.Phases?.[0]?.Maps?.[0] || "")
  ) || String(t.Phases?.[0]?.Maps?.[0] || "N/A");
  const mapType = mapName !== "N/A" ? getMapType(mapName) : "N/A";
  const mapEmoji = getMapTypeEmoji(mapType);

  const rawEmotes = t.Properties?.DisabledEmotes;
  const disabledEmotes: number[] = Array.isArray(rawEmotes)
    ? rawEmotes.map((e: any) => Number(e)).filter((e: number) => !isNaN(e))
    : [];
  const disabledEmotesText = getEmoteNames(disabledEmotes);

  const prizes = Array.isArray(t.Prizes) ? t.Prizes : [];
  const prizesText =
    prizes.length > 0
      ? prizes.map((p: any) => `**${p.position}º** › ${Number(p.amount).toLocaleString()} 💎`).join("\n")
      : "Sem prêmios definidos";

  const tournamentTypeName =
    Object.keys(TournamentType).find(
      (k) => isNaN(Number(k)) && TournamentType[k as keyof typeof TournamentType] === t.TournamentType
    ) || "Genérico";

  const phaseType =
    t.Phases?.[0]?.PhaseType !== undefined
      ? Object.keys(TournamentPhaseType).find(
          (k) =>
            isNaN(Number(k)) &&
            TournamentPhaseType[k as keyof typeof TournamentPhaseType] === t.Phases[0].PhaseType
        ) || "N/A"
      : "N/A";

  const safeStr = (v: any, fallback = "N/A"): string => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === "object") return fallback;
    return String(v) || fallback;
  };

  const regionStr = safeStr(t.Region?.toUpperCase?.() ?? t.Region, "N/A");
  const roundCountStr = safeStr(t.RoundCount, "N/A");
  const currentInvites = safeStr(t.CurrentInvites, "0");
  const maxInvites = safeStr(t.MaxInvites, "0");
  const entryFee = safeStr(t.EntryFee, "0");

  const signupTs = Math.floor(new Date(t.SignupStart).getTime() / 1000);
  const startTs = Math.floor(new Date(t.StartTime).getTime() / 1000);
  const signupStr = isNaN(signupTs) ? "N/A" : `<t:${signupTs}:F> (<t:${signupTs}:R>)`;
  const startStr = isNaN(startTs) ? "N/A" : `<t:${startTs}:F> (<t:${startTs}:R>)`;

  const embed = new EmbedBuilder()
    .setColor(isNaN(colorValue) ? 0x2ad100 : colorValue)
    .setTitle(safeStr(t.TournamentName, "Torneio"))
    .setDescription(`\`${safeStr(t.TournamentId)}\``)
    .addFields(
      { name: "Status", value: statusLabel, inline: true },
      { name: "Modo", value: getModeLabel(Number(t.PartySize) || 1), inline: true },
      { name: "Tipo", value: tournamentTypeName, inline: true },
      { name: "Jogadores", value: `${currentInvites}/${maxInvites}`, inline: true },
      { name: "Região", value: regionStr, inline: true },
      { name: "Rounds", value: roundCountStr, inline: true },
      { name: "Mapa", value: `${mapName} *(${mapType})*`, inline: true },
      { name: "Bracket", value: phaseType, inline: true },
      { name: "Taxa", value: `${entryFee}`, inline: true },
      { name: "Emotes", value: disabledEmotesText, inline: false },
      { name: "Prémios", value: prizesText, inline: false },
      { name: "Inscrições", value: signupStr, inline: false },
      { name: "Início", value: startStr, inline: false }
    )
    .setTimestamp();

  if (t.TournamentImage && typeof t.TournamentImage === "string") embed.setThumbnail(t.TournamentImage);
  if (t.Properties?.StreamURL && typeof t.Properties.StreamURL === "string") {
    embed.addFields({ name: "Stream", value: t.Properties.StreamURL, inline: false });
  }
  if (t.Properties?.IsInvitationOnly) {
    embed.addFields({ name: "Acesso", value: "Apenas por convite", inline: true });
  }

  return embed;
}

// ─── /criar-torneio ───────────────────────────────────────────────────────────
async function createTournamentCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString("nome", true);
    const modeIndex = interaction.options.getInteger("modo", true);
    const region = interaction.options.getString("regiao", true);
    const selectedMap = interaction.options.getString("mapa", true);
    const startMinutes = interaction.options.getInteger("inicio", true);
    const signupMinutes = interaction.options.getInteger("inscricao") ?? 0;
    const entryFee = interaction.options.getInteger("taxa") ?? 0;
    const emotePreset = interaction.options.getString("restricoes");
    const disabledEmotesInput = interaction.options.getString("emotesdesabilitados");
    const image = interaction.options.getString("imagem") || "";
    const color = interaction.options.getString("cor") || "#2ad100";
    const streamURL = interaction.options.getString("stream") || "";
    const invitedIdsInput = interaction.options.getString("convidados") || "";
    const prizesInput = interaction.options.getString("premios");
    const adminsInput = interaction.options.getString("admins") || "";
    const tipoStr = interaction.options.getString("tipo");
    const faseStr = interaction.options.getString("fase");

    // ── FIX: declarar agendarStr aqui ────────────────────────────────────────
    const agendarStr = interaction.options.getString("agendar");

    const mode = TOURNAMENT_MODES[modeIndex];
    const { partySize, maxInvites, rounds } = mode;

    // Emote restrictions
    let disabledEmotes: number[] = [];
    if (emotePreset && emotePreset !== "all") {
      disabledEmotes = [parseInt(emotePreset)];
    } else if (disabledEmotesInput) {
      disabledEmotes = parseEmotes(disabledEmotesInput);
    }

    const invitedIds = invitedIdsInput ? invitedIdsInput.split(",").map((id) => id.trim()).filter(Boolean) : [];
    const extraAdmins = adminsInput ? adminsInput.split(",").map((id) => id.trim()).filter(Boolean) : [];
    const prizes = prizesInput ? parsePrizes(prizesInput) : undefined;

    const tournamentType = tipoStr !== null ? parseInt(tipoStr) : TournamentType.GenericTournament;
    const phaseType = faseStr !== null ? parseInt(faseStr) : TournamentPhaseType.SingleEliminationBracket;

    // ── FIX: declarar mapValue e colorHex antes do bloco if(agendarStr) ──────
    const mapValue = Scenes[selectedMap as keyof typeof Scenes];
    if (!mapValue) {
      await interaction.editReply({ content: `❌ Mapa inválido: **${selectedMap}**` });
      return;
    }

    const colorHex = color.startsWith("#") ? color : `#${color}`;
    const colorValue = parseInt(colorHex.replace("#", ""), 16);
    if (isNaN(colorValue)) {
      await interaction.editReply({ content: `❌ Cor inválida: **${color}**. Use formato hex como #2ad100` });
      return;
    }

    // ── Agendado? ─────────────────────────────────────────────────────────────
    if (agendarStr) {
      const scheduledFor = parseScheduleDate(agendarStr);
      if (!scheduledFor) {
        await interaction.editReply({ content: `❌ Formato inválido: \`${agendarStr}\`\nUse: **DD/MM/AAAA,HH:MM**` });
        return;
      }
      const msUntil = scheduledFor.getTime() - Date.now();
      if (msUntil <= 0) {
        await interaction.editReply({ content: "❌ Essa data já passou!" });
        return;
      }
      if (msUntil > 30 * 24 * 60 * 60 * 1000) {
        await interaction.editReply({ content: "❌ Máximo 30 dias de antecedência." });
        return;
      }

      const scheduleId = `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const cfg = {
        name, region, selectedMap, mapValue, startMinutes, signupMinutes, entryFee,
        disabledEmotes, image, colorHex, streamURL, invitedIds, extraAdmins, prizes,
        tournamentType, phaseType, partySize, maxInvites, rounds, createdBy: interaction.user.id,
      };

      const timer = setTimeout(async () => {
        try {
          const now2 = new Date();
          const startTime2 = new Date(now2.getTime() + cfg.startMinutes * 60 * 1000);
          const signupStart2 = new Date(now2.getTime() + cfg.signupMinutes * 60 * 1000);
          const tournamentId2 = now2.getTime().toString();
          await CreateTournament({
            CurrentInvites: 0, MaxInvites: cfg.maxInvites, TournamentId: tournamentId2,
            TournamentName: cfg.name, TournamentImage: cfg.image, TournamentColor: cfg.colorHex,
            StartTime: startTime2, SignupStart: signupStart2, EntryFee: cfg.entryFee,
            PrizepoolId: GeneratePrizepoolId().toString(), PartySize: cfg.partySize,
            Status: TournamentStatus.NotStarted, TournamentType: cfg.tournamentType,
            Phases: [{ PhaseType: cfg.phaseType, IsPhase: false, RoundCount: cfg.rounds,
              MaxTeams: Math.floor(cfg.maxInvites / cfg.partySize), Maps: [cfg.mapValue] }],
            Region: cfg.region, RoundCount: cfg.rounds, CurrentPhaseId: 0,
            Properties: {
              IsInvitationOnly: cfg.invitedIds.length > 0, InvitedIds: cfg.invitedIds,
              DisabledEmotes: cfg.disabledEmotes, AdminIds: [cfg.createdBy, ...cfg.extraAdmins],
              StreamURL: cfg.streamURL,
            },
            MinPlayersPerMatch: 1, MaxPlayersPerMatch: cfg.partySize * 2, Prizes: cfg.prizes,
          });
          scheduledTournaments.delete(scheduleId);
          console.log(`✅ Torneio agendado "${cfg.name}" criado!`);
          try {
            const channel = await Bot.channels.fetch(interaction.channelId);
            if (channel && channel.isTextBased()) {
              await (channel as any).send({
                embeds: [
                  new EmbedBuilder()
                    .setColor(parseInt(cfg.colorHex.replace("#", ""), 16))
                    .setTitle("🚀 Torneio Agendado Criado!")
                    .setDescription(`**${cfg.name}** foi criado automaticamente.`)
                    .addFields(
                      { name: "🆔 ID", value: `\`${tournamentId2}\``, inline: true },
                      { name: "🚀 Início", value: `<t:${Math.floor(startTime2.getTime() / 1000)}:R>`, inline: true }
                    )
                    .setTimestamp(),
                ],
              });
            }
          } catch {}
        } catch (err) {
          console.error(`❌ Erro ao criar agendado ${scheduleId}:`, err);
        }
      }, msUntil);

      scheduledTournaments.set(scheduleId, {
        scheduleId, scheduledFor, createdBy: interaction.user.id, config: cfg, timer,
      });

      const schedTs = Math.floor(scheduledFor.getTime() / 1000);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(colorValue)
            .setTitle("📅 Torneio Agendado!")
            .setDescription(`**${name}** será criado em:`)
            .addFields(
              { name: "🕐 Criação", value: `<t:${schedTs}:F> (<t:${schedTs}:R>)`, inline: false },
              { name: "🆔 Schedule ID", value: `\`${scheduleId}\``, inline: true },
              { name: "🌍 Região", value: region.toUpperCase(), inline: true },
              { name: "⚔️ Modo", value: getModeLabel(partySize), inline: true },
              { name: "🗺️ Mapa", value: selectedMap, inline: true },
              { name: "🔢 Vagas", value: `${maxInvites}`, inline: true },
              { name: "🚀 Início", value: `${startMinutes} min após criação`, inline: true }
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    // ── Torneio imediato ──────────────────────────────────────────────────────
    const now = new Date();
    const startTime = new Date(now.getTime() + startMinutes * 60 * 1000);
    const signupStart = new Date(now.getTime() + signupMinutes * 60 * 1000);
    const tournamentId = now.getTime().toString();

    await CreateTournament({
      CurrentInvites: 0,
      MaxInvites: maxInvites,
      TournamentId: tournamentId,
      TournamentName: name,
      TournamentImage: image,
      TournamentColor: colorHex,
      StartTime: startTime,
      SignupStart: signupStart,
      EntryFee: entryFee,
      PrizepoolId: GeneratePrizepoolId().toString(),
      PartySize: partySize,
      Status: TournamentStatus.NotStarted,
      TournamentType: tournamentType,
      Phases: [
        {
          PhaseType: phaseType,
          IsPhase: false,
          RoundCount: rounds,
          MaxTeams: Math.floor(maxInvites / partySize),
          Maps: [mapValue],
        },
      ],
      Region: region,
      RoundCount: rounds,
      CurrentPhaseId: 0,
      Properties: {
        IsInvitationOnly: invitedIds.length > 0,
        InvitedIds: invitedIds,
        DisabledEmotes: disabledEmotes,
        AdminIds: [interaction.user.id, ...extraAdmins],
        StreamURL: streamURL,
      },
      MinPlayersPerMatch: 1,
      MaxPlayersPerMatch: partySize * 2,
      Prizes: prizes,
    });

    const mapType = getMapType(selectedMap);
    const mapEmoji = getMapTypeEmoji(mapType);
    const emotesText = getEmoteNames(disabledEmotes);
    const prizesText = prizes
      ? prizes.map((p) => `**${p.position}º** › ${p.amount.toLocaleString()} 💎`).join("\n")
      : "Sem prêmios";

    const typeName =
      Object.keys(TournamentType).find(
        (k) => isNaN(Number(k)) && TournamentType[k as keyof typeof TournamentType] === tournamentType
      ) || "Genérico";
    const phaseName =
      Object.keys(TournamentPhaseType).find(
        (k) => isNaN(Number(k)) && TournamentPhaseType[k as keyof typeof TournamentPhaseType] === phaseType
      ) || "N/A";

    const embed = new EmbedBuilder()
      .setColor(colorValue)
      .setTitle("Torneio Criado")
      .setDescription(`**${name}**\n\`${tournamentId}\``)
      .addFields(
        { name: "Região", value: region.toUpperCase(), inline: true },
        { name: "Modo", value: getModeLabel(partySize), inline: true },
        { name: "Tipo", value: typeName, inline: true },
        { name: "Vagas", value: `${maxInvites} (${rounds} rounds)`, inline: true },
        { name: "Bracket", value: phaseName, inline: true },
        { name: "Taxa", value: `${entryFee}`, inline: true },
        { name: "Mapa", value: `${selectedMap} *(${mapType})*`, inline: true },
        { name: "Privado", value: invitedIds.length > 0 ? "Sim" : "Não", inline: true },
        { name: "\u200B", value: "\u200B", inline: true },
        { name: "Inscrições", value: `<t:${Math.floor(signupStart.getTime() / 1000)}:R>`, inline: false },
        { name: "Início", value: `<t:${Math.floor(startTime.getTime() / 1000)}:R>`, inline: false },
        { name: "Emotes", value: emotesText, inline: false },
        { name: "Prémios", value: prizesText, inline: false }
      )
      .setTimestamp();

    if (image) embed.setThumbnail(image);
    if (streamURL) embed.addFields({ name: "Stream", value: streamURL, inline: false });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("❌ Erro ao criar torneio:", error);
    try {
      await interaction.editReply({ content: "❌ Erro ao criar torneio. Verifique os parâmetros e tente novamente." });
    } catch {}
  }
}

// ─── /listar ──────────────────────────────────────────────────────────────────
async function listTournaments(interaction: any) {
  try {
    const isDeferred = interaction.deferred || interaction.replied;
    if (!isDeferred) await interaction.deferReply({ ephemeral: true });

    const tournaments = await Tournament.find({}).sort({ StartTime: 1 });

    if (tournaments.length === 0) {
      const msg = { content: "📭 Nenhum torneio encontrado.", ephemeral: true };
      if (interaction.deferred) return await interaction.editReply(msg);
      return await interaction.reply(msg);
    }

    const activeTournaments = tournaments
      .filter((t) => t.Status !== TournamentStatus.Canceled)
      .map((t) => ({ ...t.toObject(), calculatedStatus: calculateTournamentStatus(t) }))
      .sort((a, b) => {
        const priority: Record<number, number> = {
          [TournamentStatus.Running]: 0,
          [TournamentStatus.InvitationOpen]: 1,
          [TournamentStatus.InvitationClose]: 2,
          [TournamentStatus.NotStarted]: 3,
          [TournamentStatus.Finished]: 4,
        };
        const aPrio = priority[a.calculatedStatus] ?? 10;
        const bPrio = priority[b.calculatedStatus] ?? 10;
        if (aPrio !== bPrio) return aPrio - bPrio;
        return new Date(a.StartTime).getTime() - new Date(b.StartTime).getTime();
      })
      .slice(0, 10);

    const embeds = activeTournaments.map((t) => buildTournamentEmbed(t, t.calculatedStatus));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_tournament")
      .setPlaceholder("Selecionar torneio...")
      .addOptions(
        activeTournaments.slice(0, 25).map((t) => ({
          label: t.TournamentName.substring(0, 100),
          description: `${STATUS_LABELS[t.calculatedStatus] || "?"} | ${getModeLabel(t.PartySize)} | ${t.CurrentInvites}/${t.MaxInvites} vagas`.substring(0, 100),
          value: t.TournamentId,
        }))
      );

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const refreshRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("reload_list").setLabel("Recarregar").setStyle(ButtonStyle.Secondary)
    );

    const payload = { embeds, components: [selectRow, refreshRow] };
    if (interaction.deferred) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, ephemeral: true });
    }
  } catch (error) {
    console.error("❌ Erro ao listar torneios:", error);
    try {
      const errMsg = { content: "❌ Erro ao listar torneios.", ephemeral: true };
      if (interaction.deferred) await interaction.editReply(errMsg);
      else await interaction.reply(errMsg);
    } catch {}
  }
}

// ─── SELECT MENU ──────────────────────────────────────────────────────────────
async function handleSelectMenu(interaction: StringSelectMenuInteraction) {
  if (interaction.customId === "select_tournament") {
    await showTournamentActions(interaction, interaction.values[0]);
  } else if (interaction.customId === "select_match_winner") {
    await processMatchWinner(interaction);
  }
}

async function showTournamentActions(interaction: StringSelectMenuInteraction, tournamentId: string) {
  try {
    const tournament = await Tournament.findOne({ TournamentId: tournamentId });
    if (!tournament) {
      await interaction.reply({ content: "❌ Torneio não encontrado.", ephemeral: true });
      return;
    }

    const embed = buildTournamentEmbed(tournament.toObject());

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`delete_${tournamentId}`).setLabel("Deletar").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`edit_${tournamentId}`).setLabel("Editar").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`listplayers_${tournamentId}`).setLabel("Jogadores").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`kick_${tournamentId}`).setLabel("Kick / Unban").setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
  } catch (error) {
    console.error("❌ Erro ao mostrar ações:", error);
    await interaction.reply({ content: "❌ Erro ao carregar ações do torneio.", ephemeral: true });
  }
}

// ─── BUTTON HANDLER ───────────────────────────────────────────────────────────
async function handleButton(interaction: ButtonInteraction) {
  const { customId } = interaction;

  if (customId === "reload_list") {
    await interaction.deferUpdate();
    await listTournaments(interaction);
  } else if (customId.startsWith("cancel_schedule_")) {
    await cancelScheduled(interaction);
  } else if (customId.startsWith("pick_winner_")) {
    await showPickWinnerMenu(interaction);
  } else if (customId.startsWith("delete_")) {
    await deleteTournament(interaction);
  } else if (customId.startsWith("edit_")) {
    await editTournament(interaction);
  } else if (customId.startsWith("listplayers_")) {
    await listPlayers(interaction);
  } else if (customId.startsWith("kick_")) {
    await showKickModal(interaction);
  }
}

// ─── DELETE TOURNAMENT ────────────────────────────────────────────────────────
async function deleteTournament(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace("delete_", "");
  try {
    const tournament = await Tournament.findOne({ TournamentId: tournamentId });
    if (!tournament) {
      await interaction.reply({ content: "❌ Torneio não encontrado.", ephemeral: true });
      return;
    }

    const isAdmin =
      AUTHORIZED_USERS.includes(interaction.user.id) ||
      tournament.Properties.AdminIds.includes(interaction.user.id);

    if (!isAdmin) {
      await interaction.reply({ content: "❌ Você não tem permissão para deletar este torneio.", ephemeral: true });
      return;
    }

    await Tournament.deleteOne({ TournamentId: tournamentId });
    await interaction.reply({
      content: `✅ Torneio **${tournament.TournamentName}** (\`${tournamentId}\`) foi deletado permanentemente.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("❌ Erro ao deletar torneio:", error);
    await interaction.reply({ content: "❌ Erro ao deletar torneio.", ephemeral: true });
  }
}

// ─── EDIT TOURNAMENT (Modal) ──────────────────────────────────────────────────
async function editTournament(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace("edit_", "");
  try {
    const tournament = await Tournament.findOne({ TournamentId: tournamentId });
    if (!tournament) {
      await interaction.reply({ content: "❌ Torneio não encontrado.", ephemeral: true });
      return;
    }

    const isAdmin =
      AUTHORIZED_USERS.includes(interaction.user.id) ||
      tournament.Properties.AdminIds.includes(interaction.user.id);

    if (!isAdmin) {
      await interaction.reply({ content: "❌ Você não tem permissão para editar este torneio.", ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_edit_${tournamentId}`)
      .setTitle("Editar Torneio");

    const nameInput = new TextInputBuilder()
      .setCustomId("tournament_name")
      .setLabel("Nome do Torneio")
      .setStyle(TextInputStyle.Short)
      .setValue(tournament.TournamentName)
      .setRequired(true);

    const colorInput = new TextInputBuilder()
      .setCustomId("tournament_color")
      .setLabel("Cor (Hex, ex: #2ad100)")
      .setStyle(TextInputStyle.Short)
      .setValue(tournament.TournamentColor || "#2ad100")
      .setRequired(true);

    const maxInvitesInput = new TextInputBuilder()
      .setCustomId("max_invites")
      .setLabel("Vagas Máximas")
      .setStyle(TextInputStyle.Short)
      .setValue(tournament.MaxInvites.toString())
      .setRequired(true);

    const feeInput = new TextInputBuilder()
      .setCustomId("entry_fee")
      .setLabel("Taxa de Entrada (diamonds)")
      .setStyle(TextInputStyle.Short)
      .setValue(tournament.EntryFee.toString())
      .setRequired(false);

    const prizesInput = new TextInputBuilder()
      .setCustomId("prizes")
      .setLabel("Prêmios (ex: 1:1000,2:500,3:250)")
      .setStyle(TextInputStyle.Short)
      .setValue(
        (tournament.Prizes ?? []).length > 0
          ? (tournament.Prizes ?? []).map((p: any) => `${p.position}:${p.amount}`).join(",")
          : ""
      )
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(maxInvitesInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(feeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(prizesInput)
    );

    await interaction.showModal(modal);
  } catch (error) {
    console.error("❌ Erro ao editar torneio:", error);
    await interaction.reply({ content: "❌ Erro ao abrir editor.", ephemeral: true });
  }
}

// ─── LIST PLAYERS ─────────────────────────────────────────────────────────────
async function listPlayers(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace("listplayers_", "");
  try {
    const users = await BackboneUser.find().limit(200);

    const playersInTournament = users.filter((user) => {
      const tData = user.Tournaments?.get(tournamentId);
      return tData?.SignedUp === true;
    });

    if (!playersInTournament.length) {
      await interaction.reply({ content: "Nenhum jogador inscrito neste torneio.", ephemeral: true });
      return;
    }

    const tournament = await Tournament.findOne({ TournamentId: tournamentId });
    const colorValue = parseInt((tournament?.TournamentColor || "#2ad100").replace("#", ""), 16);

    const embed = new EmbedBuilder()
      .setColor(colorValue)
      .setTitle("👥 Jogadores Inscritos")
      .setDescription(`**Torneio:** ${tournament?.TournamentName || tournamentId}\n**Total:** ${playersInTournament.length} jogador(es)`);

    const activeList: string[] = [];
    const kickedList: string[] = [];

    for (const user of playersInTournament) {
      const tData = user.Tournaments?.get(tournamentId);
      const userMember = tData?.PartyMembers?.find((pm: any) => pm.UserId === user.UserId);
      const isKicked = userMember?.IsKicked || false;

      const userStatusEnum = userMember?.Status ?? TournamentUserStatus.Invited;
      const statusName =
        Object.keys(TournamentUserStatus).find(
          (k) => isNaN(Number(k)) && TournamentUserStatus[k as keyof typeof TournamentUserStatus] === userStatusEnum
        ) || "Unknown";

      const entry = `\`${user.UserId}\` **${user.Username}** — ${statusName}`;
      if (isKicked) kickedList.push(`~~${entry}~~`);
      else activeList.push(entry);
    }

    if (activeList.length > 0) {
      const chunks = chunkArray(activeList, 15);
      for (const chunk of chunks.slice(0, 5)) {
        embed.addFields({ name: "✅ Ativos", value: chunk.join("\n").substring(0, 1024), inline: false });
      }
    }
    if (kickedList.length > 0) {
      embed.addFields({ name: "❌ Kickados", value: kickedList.join("\n").substring(0, 1024), inline: false });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    console.error("❌ listplayers error:", err);
    await interaction.reply({ content: "❌ Falha ao listar jogadores.", ephemeral: true });
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ─── KICK MODAL ───────────────────────────────────────────────────────────────
async function showKickModal(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace("kick_", "");

  const modal = new ModalBuilder()
    .setCustomId(`kick_modal_${tournamentId}`)
    .setTitle("🚫 Kick / Desbanir Jogador");

  const userIdInput = new TextInputBuilder()
    .setCustomId("userid")
    .setLabel("ID do Usuário")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 123456789")
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput));
  await interaction.showModal(modal);
}

// ─── MODAL HANDLER ────────────────────────────────────────────────────────────
async function handleModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId.startsWith("modal_edit_")) {
    await updateTournamentFromModal(interaction);
  } else if (interaction.customId.startsWith("kick_modal_")) {
    await kickPlayer(interaction);
  }
}

// ─── UPDATE TOURNAMENT FROM MODAL ─────────────────────────────────────────────
async function updateTournamentFromModal(interaction: ModalSubmitInteraction) {
  const tournamentId = interaction.customId.replace("modal_edit_", "");
  try {
    const tournament = await Tournament.findOne({ TournamentId: tournamentId });
    if (!tournament) {
      await interaction.reply({ content: "❌ Torneio não encontrado.", ephemeral: true });
      return;
    }

    const newName = interaction.fields.getTextInputValue("tournament_name");
    const newColor = interaction.fields.getTextInputValue("tournament_color");
    const newMaxInvites = parseInt(interaction.fields.getTextInputValue("max_invites"));
    const feeValue = interaction.fields.getTextInputValue("entry_fee");
    const prizesValue = interaction.fields.getTextInputValue("prizes");

    if (!newName.trim()) {
      await interaction.reply({ content: "❌ Nome do torneio não pode ser vazio.", ephemeral: true });
      return;
    }

    const colorHex = newColor.startsWith("#") ? newColor : `#${newColor}`;
    const colorNum = parseInt(colorHex.replace("#", ""), 16);
    if (isNaN(colorNum)) {
      await interaction.reply({ content: `❌ Cor inválida: **${newColor}**`, ephemeral: true });
      return;
    }

    if (isNaN(newMaxInvites) || newMaxInvites < 2) {
      await interaction.reply({ content: "❌ Vagas máximas inválidas (mínimo: 2).", ephemeral: true });
      return;
    }

    if (newMaxInvites < tournament.CurrentInvites) {
      await interaction.reply({
        content: `❌ Não é possível reduzir vagas abaixo do número atual de inscritos (${tournament.CurrentInvites}).`,
        ephemeral: true,
      });
      return;
    }

    tournament.TournamentName = newName;
    tournament.TournamentColor = colorHex;
    tournament.MaxInvites = newMaxInvites;

    if (feeValue.trim()) {
      const fee = parseInt(feeValue);
      if (!isNaN(fee) && fee >= 0) tournament.EntryFee = fee;
    }

    if (prizesValue.trim()) {
      tournament.Prizes = parsePrizes(prizesValue);
    } else {
      tournament.Prizes = undefined;
    }

    await tournament.save();

    await interaction.reply({
      content: `✅ Torneio **${tournament.TournamentName}** (\`${tournamentId}\`) atualizado com sucesso!`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar torneio:", error);
    await interaction.reply({ content: "❌ Erro ao atualizar torneio.", ephemeral: true });
  }
}

// ─── KICK / UNBAN PLAYER ──────────────────────────────────────────────────────
async function kickPlayer(interaction: ModalSubmitInteraction) {
  const tournamentId = interaction.customId.replace("kick_modal_", "");
  try {
    const userId = interaction.fields.getTextInputValue("userid").trim();

    if (!userId) {
      await interaction.reply({ content: "❌ ID do usuário inválido.", ephemeral: true });
      return;
    }

    const user = await BackboneUser.findOne({ UserId: userId });
    if (!user) {
      await interaction.reply({ content: `❌ Usuário \`${userId}\` não encontrado.`, ephemeral: true });
      return;
    }

    const tournamentData = user.Tournaments?.get(tournamentId);
    if (!tournamentData || !tournamentData.SignedUp) {
      await interaction.reply({ content: `❌ Usuário \`${userId}\` não está inscrito neste torneio.`, ephemeral: true });
      return;
    }

    if (!tournamentData.PartyMembers || tournamentData.PartyMembers.length === 0) {
      await interaction.reply({ content: "❌ Estrutura de party não encontrada para este usuário.", ephemeral: true });
      return;
    }

    const currentMember = tournamentData.PartyMembers.find((m: any) => m.UserId === userId);
    const isCurrentlyKicked = currentMember?.IsKicked || false;
    const newKickedState = !isCurrentlyKicked;

    tournamentData.PartyMembers = tournamentData.PartyMembers.map((member: any) => {
      if (member.UserId === userId) {
        return {
          ...member,
          IsKicked: newKickedState,
          Status: newKickedState
            ? TournamentUserStatus.KickedOutByAdmin
            : TournamentUserStatus.Confirmed,
        };
      }
      return member;
    });

    user.Tournaments.set(tournamentId, tournamentData);
    await user.save();

    const action = newKickedState ? "🚫 kickado" : "✅ desbanido";
    await interaction.reply({
      content: `${action}: Jogador \`${userId}\` (**${user.Username}**) foi **${newKickedState ? "kickado" : "desbanido"}** do torneio!`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("❌ kick error:", err);
    await interaction.reply({ content: "❌ Falha ao processar ação de kick/unban.", ephemeral: true });
  }
}

// ─── SCHEDULED TOURNAMENTS ────────────────────────────────────────────────────

function parseScheduleDate(input: string): Date | null {
  const cleaned = input.trim().replace(" ", ",");
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s](\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, day, month, year, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (isNaN(date.getTime())) return null;
  return date;
}

async function cancelScheduled(interaction: ButtonInteraction) {
  const scheduleId = interaction.customId.replace("cancel_schedule_", "");
  const item = scheduledTournaments.get(scheduleId);

  if (!item) {
    await interaction.reply({ content: "❌ Agendamento não encontrado (já foi criado ou cancelado).", ephemeral: true });
    return;
  }

  const isAuthorized =
    AUTHORIZED_USERS.includes(interaction.user.id) || item.createdBy === interaction.user.id;

  if (!isAuthorized) {
    await interaction.reply({ content: "❌ Só quem criou o agendamento pode cancelá-lo.", ephemeral: true });
    return;
  }

  clearTimeout(item.timer);
  scheduledTournaments.delete(scheduleId);

  await interaction.reply({
    content: `✅ Agendamento **${item.config.name}** (\`${scheduleId}\`) cancelado com sucesso.`,
    ephemeral: true,
  });
}

// ─── MATCHES ──────────────────────────────────────────────────────────────────

const MATCH_STATUS_LABELS: Record<number, string> = {
  [-1]: "Desconhecido",
  0: "Criada",
  1: "Aguardando Oponente",
  2: "Pronta",
  3: "Em Progresso",
  4: "Finalizada",
  5: "Encerrada",
  8: "Fechada",
};

async function listMatches(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const tournamentFilter = interaction.options.getString("torneio");

  let tournamentIds: string[] = [];
  if (tournamentFilter) {
    tournamentIds = [tournamentFilter];
  } else {
    const activeTs = await Tournament.find({
      Status: { $in: [TournamentStatus.Running, TournamentStatus.InvitationOpen, TournamentStatus.InvitationClose] },
    }).select("TournamentId");
    tournamentIds = activeTs.map((t) => t.TournamentId.toString());
  }

  if (tournamentIds.length === 0) {
    await interaction.editReply({ content: "📭 Nenhum torneio ativo no momento." });
    return;
  }

  const query: any = {
    tournamentid: { $in: tournamentIds },
    status: { $in: [TournamentMatchStatus.GameReady, TournamentMatchStatus.GameInProgress] },
  };

  const matches = await Match.find(query).sort({ roundid: 1 }).limit(50);

  if (matches.length === 0) {
    const msg = tournamentFilter
      ? `📭 Nenhuma match em andamento no torneio \`${tournamentFilter}\`.`
      : "📭 Nenhuma match em andamento nos torneios ativos.";
    await interaction.editReply({ content: msg });
    return;
  }

  const byTournament = new Map<string, typeof matches>();
  for (const m of matches) {
    const tid = m.tournamentid.toString();
    if (!byTournament.has(tid)) byTournament.set(tid, []);
    byTournament.get(tid)!.push(m);
  }

  const embeds: EmbedBuilder[] = [];
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  for (const [tid, tMatches] of byTournament.entries()) {
    const tournament = await Tournament.findOne({ TournamentId: tid });
    const tName = tournament?.TournamentName || tid;
    const colorValue = parseInt((tournament?.TournamentColor || "#ff6600").replace("#", ""), 16);

    const embed = new EmbedBuilder()
      .setColor(isNaN(colorValue) ? 0xff6600 : colorValue)
      .setTitle(tName)
      .setDescription(`\`${tid}\` — ${tMatches.length} match(es) em andamento`);

    for (const match of tMatches) {
      const statusLabel = MATCH_STATUS_LABELS[match.status] || "❓";
      const teams = buildTeamDisplay(match.users);
      embed.addFields({
        name: `Match \`${match.id}\` — Round ${match.roundid} — ${statusLabel}`,
        value: teams || "*Sem jogadores*",
        inline: false,
      });
    }

    embeds.push(embed);

    const btnRow = new ActionRowBuilder<ButtonBuilder>();
    let btnCount = 0;
    for (const match of tMatches.slice(0, 5)) {
      btnRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`pick_winner_${match.id}`)
          .setLabel(`🏆 Match ${String(match.id).slice(-4)}`)
          .setStyle(ButtonStyle.Primary)
      );
      btnCount++;
    }
    if (btnCount > 0) components.push(btnRow);
  }

  await interaction.editReply({
    embeds: embeds.slice(0, 10),
    components: components.slice(0, 5),
  });
}

function buildTeamDisplay(users: any[]): string {
  if (!users || users.length === 0) return "*Sem jogadores*";

  const teams = new Map<string, any[]>();
  for (const u of users) {
    const tid = String(u["@team-id"]);
    if (!teams.has(tid)) teams.set(tid, []);
    teams.get(tid)!.push(u);
  }

  const lines: string[] = [];
  let teamNum = 1;
  for (const [teamId, members] of teams.entries()) {
    const playerList = members.map((m) => `\`${String(m["@user-id"])}\``).join(", ");
    const score = members[0]["@team-score"];
    const isWinner = members[0]["@match-winner"] === "1";
    const winnerTag = isWinner ? " 🏆" : "";
    const scoreStr = score !== undefined && score !== "0" ? ` — Score: **${score}**` : "";
    lines.push(`**Time ${teamNum}${winnerTag}**: ${playerList}${scoreStr}`);
    teamNum++;
  }

  return lines.join("\n");
}

async function showPickWinnerMenu(interaction: ButtonInteraction) {
  const matchId = interaction.customId.replace("pick_winner_", "");

  try {
    const match = await Match.findOne({ id: matchId });
    if (!match) {
      await interaction.reply({ content: `❌ Match \`${matchId}\` não encontrada.`, ephemeral: true });
      return;
    }

    if (
      match.status !== TournamentMatchStatus.GameInProgress &&
      match.status !== TournamentMatchStatus.GameReady
    ) {
      await interaction.reply({
        content: `❌ Esta match não está em andamento (status: ${MATCH_STATUS_LABELS[match.status] || match.status}).`,
        ephemeral: true,
      });
      return;
    }

    const teamsMap = new Map<string, string[]>();
    for (const u of match.users) {
      const tid = u["@team-id"];
      if (!teamsMap.has(tid)) teamsMap.set(tid, []);
      teamsMap.get(tid)!.push(u["@user-id"]);
    }

    const teamIds = Array.from(teamsMap.keys());

    if (teamIds.length < 2) {
      await interaction.reply({ content: "❌ Não há times suficientes nesta match.", ephemeral: true });
      return;
    }

    const options = teamIds.map((tid, i) => {
      const members = teamsMap.get(tid)!;
      return {
        label: `Time ${i + 1} — ${members.slice(0, 3).join(", ")}${members.length > 3 ? "..." : ""}`.substring(0, 100),
        description: `Team ID: ${tid}`.substring(0, 100),
        value: `${matchId}||${tid}`,
      };
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId("select_match_winner")
      .setPlaceholder("🏆 Selecione o time vencedor...")
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    const embed = new EmbedBuilder()
      .setColor(0xf0a500)
      .setTitle(`Decidir Vencedor — Match \`${matchId}\``)
      .setDescription(`Torneio: \`${match.tournamentid}\` | Round: ${match.roundid}`)
      .addFields({ name: "Times", value: buildTeamDisplay(match.users), inline: false });

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  } catch (err) {
    console.error("❌ showPickWinnerMenu error:", err);
    await interaction.reply({ content: "❌ Erro ao carregar match.", ephemeral: true });
  }
}

async function processMatchWinner(interaction: StringSelectMenuInteraction) {
  const [matchId, winningTeamId] = interaction.values[0].split("||");

  try {
    await interaction.deferReply({ ephemeral: true });

    const match = await Match.findOne({ id: matchId });
    if (!match) {
      await interaction.editReply({ content: `❌ Match \`${matchId}\` não encontrada.` });
      return;
    }

    if (
      match.status !== TournamentMatchStatus.GameInProgress &&
      match.status !== TournamentMatchStatus.GameReady
    ) {
      await interaction.editReply({
        content: `❌ Esta match não pode mais ser editada (status: ${MATCH_STATUS_LABELS[match.status] || match.status}).`,
      });
      return;
    }

    const tournament = await Tournament.findOne({ TournamentId: match.tournamentid });
    if (!tournament) {
      await interaction.editReply({ content: "❌ Torneio desta match não encontrado." });
      return;
    }

    const teamsMap = new Map<string, any[]>();
    for (const u of match.users) {
      const tid = u["@team-id"];
      if (!teamsMap.has(tid)) teamsMap.set(tid, []);
      teamsMap.get(tid)!.push(u);
    }

    const teamIds = Array.from(teamsMap.keys());
    const numTeams = teamIds.length;

    const sortedTeams = [winningTeamId, ...teamIds.filter((t) => t !== winningTeamId)];

    for (const matchUser of match.users) {
      const isWinner = matchUser["@team-id"] === winningTeamId;
      const posIndex = sortedTeams.indexOf(matchUser["@team-id"]);
      const score = numTeams - posIndex;

      matchUser["@match-winner"] = isWinner ? "1" : "0";
      matchUser["@match-points"] = isWinner ? "1" : "0";
      matchUser["@team-score"] = score.toString();
    }

    const updateResult = await Match.updateOne(
      { id: matchId },
      { $set: { status: TournamentMatchStatus.GameFinished, users: match.users } }
    );

    if (updateResult.modifiedCount === 0) {
      await interaction.editReply({ content: "⚠️ A match não foi atualizada (já processada?)." });
      return;
    }

    const winningUserIds = match.users
      .filter((u: any) => u["@team-id"] === winningTeamId)
      .map((u: any) => u["@user-id"]);

    const allMatchUserIds = match.users.map((u: any) => u["@user-id"]);
    const allMatchUsers = await BackboneUser.find({ UserId: { $in: allMatchUserIds } });
    const winningUsers = allMatchUsers.filter((u) => winningUserIds.includes(u.UserId));

    for (const winner of winningUsers) {
      await Qualify(winner, tournament as any);
    }

    const winnerMembers = teamsMap.get(winningTeamId) || [];
    const winnerDisplay = winnerMembers.map((u: any) => `\`${u["@user-id"]}\``).join(", ");

    const embed = new EmbedBuilder()
      .setColor(0x2ad100)
      .setTitle("Vencedor Definido")
      .setDescription(`Match \`${matchId}\` foi concluída manualmente.`)
      .addFields(
        { name: "🥇 Time Vencedor", value: `Time ID: \`${winningTeamId}\`\n${winnerDisplay}`, inline: false },
        { name: "⚔️ Torneio", value: tournament.TournamentName, inline: true },
        { name: "📋 Round", value: match.roundid.toString(), inline: true },
        { name: "👤 Decidido por", value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("❌ processMatchWinner error:", err);
    try { await interaction.editReply({ content: "❌ Erro ao processar vencedor." }); } catch {}
  }
}

export default Bot;
