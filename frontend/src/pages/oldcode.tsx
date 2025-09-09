/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/prefer-as-const */
/* eslint-disable prefer-const */
//eslint-disable no-console 
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { StepsList } from '../components/StepsList';
import { FileExplorer } from '../components/FileExplorer';
import { TabView } from '../components/TabView';
import { CodeEditor } from '../components/CodeEditor';
import { PreviewFrame } from '../components/PreviewFrame';
import { Step, FileItem, StepType } from '../types';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import { parseXml } from '../steps';
import { useWebContainer } from '../hooks/useWebContainer';
import { FileNode } from '@webcontainer/api';
import { Loader } from '../components/Loader';
import { WebContainer } from '@webcontainer/api';

export function Builder() {
  const location = useLocation();
  const { prompt } = location.state as { prompt: string };
  const [userPrompt, setPrompt] = useState("");
  const [llmMessages, setLlmMessages] = useState<{role: "user" | "assistant", content: string;}[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateSet, setTemplateSet] = useState(false);
  const webcontainer = useWebContainer();

  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  
  const [steps, setSteps] = useState<Step[]>([]);

  const [files, setFiles] = useState<FileItem[]>([]);

  // Process pending steps and update files
  useEffect(() => {
    const pendingSteps = steps.filter(({status}) => status === "pending");
    
    if (pendingSteps.length === 0) return;

    setFiles(currentFiles => {
      let newFiles = [...currentFiles];
      let hasChanges = false;

      pendingSteps.forEach(step => {
        if (step?.type === StepType.CreateFile && step.path && step.code) {
          hasChanges = true;
          const parsedPath = step.path.split("/");
          let currentFileStructure = newFiles;
          let finalAnswerRef = currentFileStructure;

          let currentFolder = "";
          for (let i = 0; i < parsedPath.length; i++) {
            const currentFolderName = parsedPath[i];
            currentFolder = `${currentFolder}/${currentFolderName}`;

            if (i === parsedPath.length - 1) {
              // Final file
              const existingFileIndex = currentFileStructure.findIndex(x => x.path === currentFolder);
              if (existingFileIndex === -1) {
                currentFileStructure.push({
                  name: currentFolderName,
                  type: 'file',
                  path: currentFolder,
                  content: step.code
                });
              } else {
                currentFileStructure[existingFileIndex] = {
                  ...currentFileStructure[existingFileIndex],
                  content: step.code
                };
              }
            } else {
              // In a folder
              let folderIndex = currentFileStructure.findIndex(x => x.path === currentFolder);
              if (folderIndex === -1) {
                // Create the folder
                const newFolder: FileItem = {
                  name: currentFolderName,
                  type: 'folder',
                  path: currentFolder,
                  children: []
                };
                currentFileStructure.push(newFolder);
                folderIndex = currentFileStructure.length - 1;
              }

              if (!currentFileStructure[folderIndex].children) {
                currentFileStructure[folderIndex].children = [];
              }
              currentFileStructure = currentFileStructure[folderIndex].children!;
            }
          }
          newFiles = finalAnswerRef;
        }
      });

      if (hasChanges) {
        // Mark all pending steps as completed
        setSteps(currentSteps => 
          currentSteps.map(step => ({
            ...step,
            status: step.status === "pending" ? "completed" : step.status
          }))
        );
      }

      return newFiles;
    });
  }, [steps]);

  // Mount files to webcontainer
  useEffect(() => {
    if (!webcontainer || files.length === 0) return;

    const createMountStructure = (files: FileItem[]): Record<string, any> => {
      const mountStructure: Record<string, any> = {};

      const processFile = (file: FileItem, isRootFolder: boolean) => {  
        if (file.type === 'folder') {
          // For folders, create a directory entry
          mountStructure[file.name] = {
            directory: file.children ? 
              Object.fromEntries(
                file.children.map(child => [child.name, processFile(child, false)])
              ) 
              : {}
          };
        } else if (file.type === 'file') {
          if (isRootFolder) {
            mountStructure[file.name] = {
              file: {
                contents: file.content || ''
              }
            };
          } else {
            // For files, create a file entry with contents
            return {
              file: {
                contents: file.content || ''
              }
            };
          }
        }

        return mountStructure[file.name];
      };

      // Process each top-level file/folder
      files.forEach(file => processFile(file, true));

      return mountStructure;
    };

    const mountStructure = createMountStructure(files);
    console.log('Mounting structure:', mountStructure);
    webcontainer.mount(mountStructure);
  }, [files, webcontainer]);

  async function init() {
    // Clear previous state
    setFiles([]);
    setSteps([]);
    setLlmMessages([]);
    
    const response = await axios.post(`${BACKEND_URL}/template`, {
      prompt: prompt.trim()
    });
    setTemplateSet(true);
    
    const {prompts, uiPrompts} = response.data;

    console.log('Template response:', response.data);
    console.log('UI Prompts:', uiPrompts);

    if (uiPrompts && uiPrompts[0]) {
      const initialSteps = parseXml(uiPrompts[0]);
      console.log('Initial steps from template:', initialSteps);
      
      setSteps(initialSteps.map((x: Step) => ({
        ...x,
        status: "pending"
      })));
    }

    setLoading(true);
    const stepsResponse = await axios.post(`${BACKEND_URL}/chat`, {
      messages: [...prompts, prompt].map(content => ({
        role: "user",
        content
      }))
    });

    setLoading(false);

    console.log('LLM Response:', stepsResponse.data.response);
    
    const newSteps = parseXml(stepsResponse.data.response);
    console.log('Parsed steps from LLM:', newSteps);

    setSteps(s => [...s, ...newSteps.map(x => ({
      ...x,
      status: "pending" as "pending"
    }))]);

    const userMessages = [...prompts, prompt].map(content => ({
      role: "user" as const,
      content
    }));

    setLlmMessages(userMessages);
    setLlmMessages(x => [...x, {role: "assistant", content: stepsResponse.data.response}]);
  }

  useEffect(() => {
    init();
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-100">Website Builder</h1>
        <p className="text-sm text-gray-400 mt-1">Prompt: {prompt}</p>
      </header>
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-4 gap-6 p-6">
          <div className="col-span-1 space-y-6 overflow-auto">
            <div>
              <div className="max-h-[75vh] overflow-scroll">
                <StepsList
                  steps={steps}
                  currentStep={currentStep}
                  onStepClick={setCurrentStep}
                />
              </div>
              <div>
                <div className='flex'>
                  <br />
                  {(loading || !templateSet) && <Loader />}
                  {!(loading || !templateSet) && <div className='flex'>
                    <textarea value={userPrompt} onChange={(e) => {
                    setPrompt(e.target.value)
                  }} className='p-2 w-full'></textarea>
                  <button onClick={async () => {
                    const newMessage = {
                      // eslint-disable-next-line @typescript-eslint/prefer-as-const
                      role: "user" as "user",
                      content: userPrompt
                    };

                    console.log('Sending additional prompt:', userPrompt);
                    console.log('Current LLM messages:', llmMessages);

                    setLoading(true);
                    const stepsResponse = await axios.post(`${BACKEND_URL}/chat`, {
                      messages: [...llmMessages, newMessage]
                    });
                    setLoading(false);

                    console.log('Additional LLM Response:', stepsResponse.data.response);
                    
                    const additionalSteps = parseXml(stepsResponse.data.response);
                    console.log('Additional parsed steps:', additionalSteps);

                    setLlmMessages(x => [...x, newMessage]);
                    setLlmMessages(x => [...x, {
                      role: "assistant",
                      content: stepsResponse.data.response
                    }]);
                    
                    setSteps(s => [...s, ...additionalSteps.map(x => ({
                      ...x,
                      status: "pending" as "pending"
                    }))]);

                    // Clear the input
                    setPrompt("");

                  }} className='bg-purple-400 px-4'>Send</button>
                  </div>}
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-1">
              <FileExplorer 
                files={files} 
                onFileSelect={setSelectedFile}
              />
            </div>
          <div className="col-span-2 bg-gray-900 rounded-lg shadow-lg p-4 h-[calc(100vh-8rem)]">
            <TabView activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="h-[calc(100%-4rem)]">
              {activeTab === 'code' ? (
                <CodeEditor file={selectedFile} />
              ) : (
                webcontainer && <PreviewFrame webContainer={webcontainer} files={files} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}