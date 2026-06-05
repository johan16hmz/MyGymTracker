import { useState } from 'react';
import type { Exercise } from '../types';
import { WORKOUT_TEMPLATES } from '../templatesAdvanced';
import './TemplateSelector.css';

interface TemplateSelectorProps {
  onSelectTemplate: (exercises: Exercise[]) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function TemplateSelector({ onSelectTemplate }: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selections, setSelections] = useState<{ [groupIndex: number]: number[] }>({});

  const template = selectedTemplate !== null ? WORKOUT_TEMPLATES[selectedTemplate] : null;

  const handleTemplateSelect = (index: number) => {
    setSelectedTemplate(index);
    setSelections({});
  };

  const handleExerciseSelect = (groupIndex: number, optionIndex: number) => {
    setSelections(prev => {
      const groupSelections = prev[groupIndex] || [];
      const isSelected = groupSelections.includes(optionIndex);
      
      return {
        ...prev,
        [groupIndex]: isSelected 
          ? groupSelections.filter(i => i !== optionIndex)
          : [...groupSelections, optionIndex]
      };
    });
  };

  const handleConfirm = () => {
    if (template === null) return;

    const exercises: Exercise[] = [];

    template.muscleGroups.forEach((muscleGroup, groupIndex) => {
      const selectedOptionIndices = selections[groupIndex] || [];
      
      // Ajouter tous les exercices sélectionnés pour ce groupe musculaire
      selectedOptionIndices.forEach(optionIndex => {
        const option = muscleGroup.options[optionIndex];

        if (option) {
          exercises.push({
            id: generateId(),
            name: option.name,
            sets: option.sets.map(set => ({
              ...set,
              id: generateId(),
            })),
          });
        }
      });
    });

    onSelectTemplate(exercises);
  };

  const allGroupsSelected = template ? true : false;

  return (
    <div className="template-selector">
      <h2>Sélectionner une séance</h2>

      {!template ? (
        <div className="templates-grid">
          {WORKOUT_TEMPLATES.map((tpl, index) => (
            <button
              key={index}
              className="template-card"
              onClick={() => handleTemplateSelect(index)}
            >
              <div className="template-emoji">🏋️</div>
              <div className="template-name">{tpl.name}</div>
              <div className="template-count">
                {tpl.muscleGroups.length} groupes musculaires
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="template-details">
          <button
            className="btn btn-back"
            onClick={() => {
              setSelectedTemplate(null);
              setSelections({});
            }}
          >
            ← Retour aux séances
          </button>

          <h3>{template.name}</h3>

          <div className="exercise-groups">
            {template.muscleGroups.map((muscleGroup, groupIndex) => (
              <div key={groupIndex} className="exercise-group">
                <div className="group-header">
                  <span className="group-label">
                    💪 {muscleGroup.name}
                  </span>
                  <span className="group-number">Groupe {groupIndex + 1}</span>
                </div>

                <div className="options-list">
                  {muscleGroup.options.map((option, optionIndex) => {
                    const isSelected = (selections[groupIndex] || []).includes(optionIndex);
                    return (
                      <button
                        key={optionIndex}
                        className={`option-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleExerciseSelect(groupIndex, optionIndex)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ marginRight: '0.5rem' }}
                        />
                        <div className="option-content">
                          <div className="option-name">{option.name}</div>
                          <div className="option-sets">
                            {option.sets.map((set, idx) => (
                              <span key={idx} className="set-info">
                                {set.weight > 0 ? `${set.weight}kg` : '?'} ×{set.repsMin && set.repsMax ? `${set.repsMin}-${set.repsMax}` : set.reps || '?'}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="selector-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSelectedTemplate(null);
                setSelections({});
              }}
            >
              Annuler
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={!allGroupsSelected}
            >
              Utiliser cette séance
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
