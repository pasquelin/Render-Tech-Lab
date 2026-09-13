import { useLab } from './LabContext.tsx';
import { ChoiceCard } from './ui/ChoiceCard.tsx';

const scenes = [
  { id: 'model' as const, title: 'Modèles préparés', description: 'Explorez l’un des modèles complets et observez les compteurs de navigation. Un parcours reproductible permet de suivre la navigation par étapes ; le comparatif reste indisponible.' },
  { id: 'procedural' as const, title: 'Fixture procédurale', description: 'Exécutez trois contrôles reproductibles pour vérifier la qualité du rendu et le fonctionnement des briques techniques.' },
];

export function IntegrationSceneCards() {
  const { model, onIntegrationScene, state } = useLab();
  const selected = model ? 'model' : 'procedural';
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full text-left" aria-label="Usages du banc 15">
      {scenes.map(scene => (
        <ChoiceCard key={scene.id} pressed={selected === scene.id} disabled={state.running} className="p-4" onClick={() => onIntegrationScene?.(scene.id)}>
          <h2 className="font-semibold text-sm">{scene.title}</h2>
          <p className="mt-2 text-xs text-base-content/65">{scene.description}</p>
        </ChoiceCard>
      ))}
    </section>
  );
}
