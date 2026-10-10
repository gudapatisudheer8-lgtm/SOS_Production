import React from 'react';
import { Building, ShieldCheck, TreePine } from 'lucide-react';
import type { LayoutAmenity, Project } from '../../types';

export const savedProjectText = (value?: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : 'Unspecified';

const savedMeasurement = (value: unknown, maximum = Infinity) => {
  const number = typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())
    ? Number(value.trim())
    : value;
  return typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= maximum
    ? number
    : undefined;
};

const AmenityList = ({ amenities }: { amenities: LayoutAmenity[] }) => (
  <ul className="text-[11px] space-y-2">
    {amenities.length ? amenities.map((amenity, index) => {
      const area = savedMeasurement(amenity.allocatedAreaSqYards);
      return (
        <li key={`${amenity.id}-${index}`}>
          <span className="font-bold block">{savedProjectText(amenity.name)}</span>
          <span className="block">
            Allocated area: {area === undefined ? 'Unspecified' : `${area} Sq.Yards`}
          </span>
        </li>
      );
    }) : <li>Unspecified</li>}
  </ul>
);

/** Read-only saved details; never derive reservations from layout calculations. */
export const ProjectLayoutDetails = ({ project }: { project?: Project }) => {
  const openSpacePercent = savedMeasurement(project?.openSpacePercent, 100);
  const amenities = project?.layoutAmenities ?? [];

  return (
    <>
      <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-2 text-slate-900">
        <div className="flex items-center gap-2 font-black text-xs">
          <ShieldCheck className="w-4 h-4" />
          <span>Saved Project Approval Details</span>
        </div>
        <div className="text-[11px] space-y-1">
          <p>Approval authority: {savedProjectText(project?.approvalAuthority)}</p>
          <p>LP / RERA number: {savedProjectText(project?.lpOrReraNumber)}</p>
          <p className="text-slate-500">Saved references do not verify sanction status.</p>
        </div>
      </div>
      <div className="bg-emerald-50/70 p-4 rounded-3xl border border-emerald-300 space-y-2 text-emerald-950">
        <div className="flex items-center gap-2 font-black text-xs">
          <TreePine className="w-4 h-4 text-emerald-700" />
          <span>Saved Open Space</span>
        </div>
        <p className="text-[11px] font-semibold">
          Open space: {openSpacePercent === undefined ? 'Unspecified' : `${openSpacePercent}%`}
        </p>
      </div>
      <div className="bg-blue-50/70 p-4 rounded-3xl border border-blue-200 space-y-2 text-blue-900">
        <div className="flex items-center gap-2 text-blue-950 font-black text-xs">
          <Building className="w-4 h-4 text-blue-700" />
          <span>Saved Parks, Amenities &amp; Infrastructure</span>
        </div>
        {/* The project form also saves uncategorized parks; do not classify by name. */}
        <AmenityList amenities={amenities} />
      </div>
    </>
  );
};
