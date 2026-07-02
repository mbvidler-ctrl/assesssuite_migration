import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function ClientSelectorModal({
  isOpen,
  clients,
  testName,
  onSelect,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Select Client</h2>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Select a client for the {testName}
        </p>

        <div className="space-y-2 max-h-96 overflow-y-auto mb-6 border border-slate-200 rounded-lg">
          {clients.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              No clients found
            </div>
          ) : (
            clients.map((client) => (
              <button
                key={client.id}
                onClick={() => onSelect(client)}
                className="w-full text-left p-4 border-b hover:bg-blue-50 transition-colors last:border-b-0 focus:outline-none focus:bg-blue-50"
              >
                <p className="font-semibold text-slate-900">{client.full_name}</p>
                {client.date_of_birth && (
                  <p className="text-xs text-slate-500 mt-1">
                    DOB: {new Date(client.date_of_birth).toLocaleDateString()}
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        <Button
          onClick={onCancel}
          variant="outline"
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}