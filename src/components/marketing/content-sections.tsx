import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MessageSquare,
  ScanSearch,
  FileText,
  ListChecks,
  Terminal,
  Download,
  Code2,
  Layers,
  Compass,
} from "lucide-react";
export function SectionHeading({
  number,
  eyebrow,
  title,
  children,
}: {
  number: string;
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mk-section-heading">
      <p className="mk-eyebrow">
        <span>{number}</span> {eyebrow}
      </p>
      <h2>{title}</h2>
      {children && <p className="mk-section-intro">{children}</p>}
    </div>
  );
}
export function ProblemSection() {
  return (
    <section className="mk-problem mk-section">
      <div className="mk-container mk-problem-grid">
        <div>
          <p className="mk-eyebrow">AVANT LA PREMIÈRE LIGNE DE CODE</p>
          <h2>
            « On voudrait un site.
            <br />
            <span>Un truc assez simple. »</span>
          </h2>
          <p>
            Tout projet commence par une idée. Le plus difficile, c’est de
            savoir ce qu’elle implique vraiment.
          </p>
        </div>
        <ul>
          {[
            [
              "01",
              "Des briefs qui laissent trop de place au doute",
              "Objectifs imprécis, exigences ambiguës et informations manquantes.",
            ],
            [
              "02",
              "Des échanges qui tournent en boucle",
              "Les mêmes questions, les mêmes oublis, des décisions dispersées.",
            ],
            [
              "03",
              "Un développement qui part trop tôt",
              "Une compréhension différente du besoin, des ajustements et des retards.",
            ],
          ].map(([n, title, text]) => (
            <li key={n}>
              <span>{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
export function SolutionSection() {
  return (
    <section className="mk-section mk-container mk-solution">
      <SectionHeading
        number="01"
        eyebrow="METTRE LES IDÉES AU CLAIR"
        title="Le lien entre « j’ai une idée » et « on peut commencer »."
      >
        Un assistant de cadrage pour faire émerger les bonnes informations,
        distinguer les hypothèses et préparer la suite avec votre client.
      </SectionHeading>
      <div className="mk-transformation">
        <div>
          <span className="mk-step-label">LE POINT DE DÉPART</span>
          <p>
            Une demande.
            <br />
            Beaucoup de questions.
          </p>
          <span className="mk-rough-lines">
            Objectifs ? Périmètre ? Contraintes ?
          </span>
        </div>
        <ArrowRight aria-hidden="true" className="mk-transform-arrow" />
        <div className="mk-transform-result">
          <span className="mk-step-label">AVEC BRIEFPILOT AI</span>
          <p>
            Des besoins structurés.
            <br />
            Une prochaine étape claire.
          </p>
          <span>Interview → Brief → Backlog → Livrables</span>
        </div>
      </div>
    </section>
  );
}
export const features = [
  {
    icon: MessageSquare,
    title: "Une interview qui fait avancer",
    text: "L’IA vous aide à préciser les objectifs, les utilisateurs, les contenus et les contraintes du projet.",
    label: "COLLECTER",
  },
  {
    icon: ScanSearch,
    title: "Les angles morts deviennent visibles",
    text: "Repérez les informations manquantes et distinguez ce qui est confirmé de ce qui reste à valider.",
    label: "CLARIFIER",
  },
  {
    icon: FileText,
    title: "Un cahier des charges exploitable",
    text: "Rassemblez périmètre, fonctionnalités, pages, exigences et critères d’acceptation dans un document structuré.",
    label: "STRUCTURER",
  },
  {
    icon: ListChecks,
    title: "Un backlog pour passer à l’action",
    text: "Décomposez le cahier des charges en tâches techniques reliées aux besoins du projet.",
    label: "PLANIFIER",
  },
  {
    icon: Terminal,
    title: "Des prompts pour vos outils de code",
    text: "Préparez des tâches et prompts Codex à relire et à utiliser dans votre workflow de développement.",
    label: "PRÉPARER",
  },
  {
    icon: Download,
    title: "Des livrables qui vous suivent",
    text: "Exportez vos documents en Markdown ou PDF pour les partager et poursuivre le travail dans vos outils.",
    label: "TRANSMETTRE",
  },
];
export function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="mk-section mk-features">
      <div className="mk-container">
        <SectionHeading
          number="02"
          eyebrow="LE NÉCESSAIRE, BIEN ORGANISÉ"
          title="Un projet mieux préparé, de bout en bout."
        >
          De la collecte des besoins clients aux tâches de développement, gardez
          un fil conducteur.
        </SectionHeading>
        <div className="mk-feature-grid">
          {features.map(({ icon: Icon, title, text, label }) => (
            <article key={label}>
              <div className="mk-feature-top">
                <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                <span>{label}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
export const workflow = [
  [
    "Créer un projet",
    "Posez le contexte, le type de projet et la demande initiale.",
  ],
  [
    "Lancer l’interview IA",
    "Commencez une conversation guidée autour du besoin.",
  ],
  [
    "Collecter les informations",
    "Complétez les réponses avec votre client, à votre rythme.",
  ],
  [
    "Générer le cahier des charges",
    "Relisez les exigences et les informations à préciser.",
  ],
  [
    "Générer le backlog",
    "Préparez les tâches et les prompts pour le développement.",
  ],
  ["Exporter les livrables", "Récupérez vos documents en Markdown ou PDF."],
];
export function WorkflowSection() {
  return (
    <section id="fonctionnement" className="mk-section mk-container">
      <div className="mk-workflow-heading">
        <SectionHeading
          number="03"
          eyebrow="UNE MÉTHODE, PAS UNE PAGE BLANCHE"
          title="Du premier échange au prochain commit."
        />
        <Link href="/how-it-works" className="mk-text-link">
          Explorer la méthode <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <ol className="mk-workflow">
        {workflow.map(([title, text], index) => (
          <li key={title}>
            <span className="mk-workflow-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function AudienceSection() {
  return (
    <section className="mk-section mk-container">
      <SectionHeading
        number="05"
        eyebrow="VOTRE EXPERTISE, MIEUX PRÉPARÉE"
        title="À chacun sa façon de faire avancer un projet."
      />
      <div className="mk-audiences">
        {[
          {
            icon: Code2,
            name: "Développeurs freelances",
            title: "Cadrez avant de chiffrer.",
            text: "Clarifiez le périmètre avec votre client et préparez un point de départ concret pour votre devis et votre développement.",
          },
          {
            icon: Layers,
            name: "Agences digitales",
            title: "Un fil commun pour vos projets.",
            text: "Donnez une structure cohérente à vos recueils de besoins et préparez des livrables à partager avec vos équipes.",
          },
          {
            icon: Compass,
            name: "Chefs de projet & entrepreneurs",
            title: "Rendez votre vision exploitable.",
            text: "Mettez des mots précis sur votre idée de site ou d’application pour mieux échanger avec les personnes qui la construiront.",
          },
        ].map(({ icon: Icon, name, title, text }) => (
          <article key={name}>
            <Icon size={23} aria-hidden="true" />
            <p className="mk-audience-name">{name}</p>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
